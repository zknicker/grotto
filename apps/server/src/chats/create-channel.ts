import type { HostedChannelCreateInput, HostedChat } from '@tavern/api';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { violatesConstraint } from '../postgres/constraint-violation.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    channelParticipantsTable,
    chatsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { listHostedChats } from './list-chats.ts';

export class ChannelAgentNotFoundError extends Error {
    constructor() {
        super('Choose Agents that belong to this Server.');
    }
}

export class ChannelNameTakenError extends Error {
    constructor() {
        super('A channel already uses that name.');
    }
}

export async function createHostedChannel(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedChannelCreateInput
): Promise<HostedChat> {
    const chatId = await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireServerMembership(tx, member, input.serverId);
        if (!member) {
            throw new Error('Authenticated Server membership requires a Grotto User.');
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

        const id = createOpaqueId('cht');
        try {
            await tx.insert(chatsTable).values({
                id,
                kind: 'channel',
                name: input.name,
                serverId: input.serverId,
            });
        } catch (error) {
            if (violatesConstraint(error, 'chats_server_channel_name_key')) {
                throw new ChannelNameTakenError();
            }
            throw error;
        }

        await tx.insert(channelParticipantsTable).values({
            chatId: id,
            serverId: input.serverId,
            userId: member.id,
        });
        await tx
            .insert(channelAgentParticipantsTable)
            .values(agentIds.map((agentId) => ({ agentId, chatId: id, serverId: input.serverId })));
        return id;
    });

    const channel = (await listHostedChats(db, member, input.serverId)).find(
        (candidate) => candidate.id === chatId
    );
    if (!channel) {
        throw new Error('Failed to open the new channel.');
    }
    return channel;
}
