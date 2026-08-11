import type { HostedChannelUpdateInput, HostedChat, HostedDurableEvent } from '@tavern/api';
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { violatesConstraint } from '../postgres/constraint-violation.ts';
import { agentsTable, channelAgentParticipantsTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireHostedChatWritable } from './chat-access.ts';
import { ChannelAgentNotFoundError, ChannelNameTakenError } from './create-channel.ts';
import { insertHostedLifecycleEvent } from './lifecycle-events.ts';
import { listHostedChats } from './list-chats.ts';

export class ChannelNotFoundError extends Error {
    constructor() {
        super('That channel does not exist on this Server.');
    }
}

export interface UpdatedHostedChannel {
    chat: HostedChat;
    /** Null when the save changed neither the name nor the Agent participant set. */
    event: HostedDurableEvent | null;
}

/** Renames a channel and replaces its Agent participant set. */
export async function updateHostedChannel(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedChannelUpdateInput
): Promise<UpdatedHostedChannel> {
    const event = await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireServerMembership(tx, member, input.serverId);
        if (!member) {
            throw new Error('Authenticated Server membership requires a Grotto User.');
        }
        await requireHostedChatWritable(tx, input);

        const [chat] = await tx
            .select({ id: chatsTable.id, kind: chatsTable.kind, name: chatsTable.name })
            .from(chatsTable)
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)));
        if (!chat || chat.kind !== 'channel') {
            throw new ChannelNotFoundError();
        }

        const agentIds = [...new Set(input.agentIds)].sort();
        const agents = await tx
            .select({ id: agentsTable.id })
            .from(agentsTable)
            .where(
                and(
                    eq(agentsTable.serverId, input.serverId),
                    inArray(agentsTable.id, agentIds),
                    isNull(agentsTable.retiredAt)
                )
            );
        if (agents.length !== agentIds.length) {
            throw new ChannelAgentNotFoundError();
        }

        const previousAgentIds = (
            await tx
                .select({ agentId: channelAgentParticipantsTable.agentId })
                .from(channelAgentParticipantsTable)
                .where(
                    and(
                        eq(channelAgentParticipantsTable.serverId, input.serverId),
                        eq(channelAgentParticipantsTable.chatId, input.chatId)
                    )
                )
        )
            .map((row) => row.agentId)
            .sort();
        const changed = chat.name !== input.name || previousAgentIds.join() !== agentIds.join();

        try {
            await tx
                .update(chatsTable)
                .set({ name: input.name })
                .where(
                    and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId))
                );
        } catch (error) {
            if (violatesConstraint(error, 'chats_server_channel_name_key')) {
                throw new ChannelNameTakenError();
            }
            throw error;
        }

        await tx
            .delete(channelAgentParticipantsTable)
            .where(
                and(
                    eq(channelAgentParticipantsTable.serverId, input.serverId),
                    eq(channelAgentParticipantsTable.chatId, input.chatId),
                    notInArray(channelAgentParticipantsTable.agentId, agentIds)
                )
            );
        await tx
            .insert(channelAgentParticipantsTable)
            .values(
                agentIds.map((agentId) => ({
                    agentId,
                    chatId: input.chatId,
                    serverId: input.serverId,
                }))
            )
            .onConflictDoNothing();

        return changed ? await insertHostedLifecycleEvent(tx, input, 'updated', new Date()) : null;
    });

    const channel = (await listHostedChats(db, member, input.serverId)).find(
        (candidate) => candidate.id === input.chatId
    );
    if (!channel) {
        throw new Error('Failed to reload the updated channel.');
    }
    return { chat: channel, event };
}
