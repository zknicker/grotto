import { parseAgentReferenceTarget, parseTavernRichReferences } from '@tavern/api';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentChannelMutesTable,
    agentsTable,
    agentThreadFollowsTable,
    channelAgentParticipantsTable,
    chatsTable,
} from '../postgres/schema.ts';

export interface AgentMessageRecipientPlan {
    agentId: string;
    pierced: boolean;
}

export async function planAgentMessageRecipients(
    db: GrottoDatabase,
    input: {
        authorAgentId: string | null;
        chatId: string;
        content: string;
        serverId: string;
    }
): Promise<AgentMessageRecipientPlan[]> {
    const [chat] = await db
        .select({
            dmAgentId: chatsTable.dmAgentId,
            kind: chatsTable.kind,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);
    if (!chat) {
        return [];
    }
    if (chat.kind === 'dm') {
        return chat.dmAgentId && chat.dmAgentId !== input.authorAgentId
            ? [{ agentId: chat.dmAgentId, pierced: false }]
            : [];
    }

    const parentChatId = chat.kind === 'thread' ? chat.parentChatId : input.chatId;
    if (!parentChatId) {
        return [];
    }
    if (chat.kind === 'thread') {
        const [parent] = await db
            .select({ dmAgentId: chatsTable.dmAgentId, kind: chatsTable.kind })
            .from(chatsTable)
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, parentChatId)))
            .limit(1);
        if (parent?.kind === 'dm') {
            return parent.dmAgentId && parent.dmAgentId !== input.authorAgentId
                ? [{ agentId: parent.dmAgentId, pierced: false }]
                : [];
        }
    }
    const joined = await db
        .select({ agentId: channelAgentParticipantsTable.agentId })
        .from(channelAgentParticipantsTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, channelAgentParticipantsTable.serverId),
                eq(agentsTable.id, channelAgentParticipantsTable.agentId)
            )
        )
        .where(
            and(
                eq(channelAgentParticipantsTable.serverId, input.serverId),
                eq(channelAgentParticipantsTable.chatId, parentChatId),
                isNull(agentsTable.retiredAt)
            )
        );
    const agentIds = joined
        .map((row) => row.agentId)
        .filter((agentId) => agentId !== input.authorAgentId);
    if (agentIds.length === 0) {
        return [];
    }
    const [agents, mutes, follows] = await Promise.all([
        db
            .select({ handle: agentsTable.handle, id: agentsTable.id })
            .from(agentsTable)
            .where(
                and(eq(agentsTable.serverId, input.serverId), inArray(agentsTable.id, agentIds))
            ),
        db
            .select({ agentId: agentChannelMutesTable.agentId })
            .from(agentChannelMutesTable)
            .where(
                and(
                    eq(agentChannelMutesTable.serverId, input.serverId),
                    eq(agentChannelMutesTable.chatId, parentChatId),
                    inArray(agentChannelMutesTable.agentId, agentIds)
                )
            ),
        chat.kind === 'thread'
            ? db
                  .select({
                      agentId: agentThreadFollowsTable.agentId,
                      followed: agentThreadFollowsTable.followed,
                  })
                  .from(agentThreadFollowsTable)
                  .where(
                      and(
                          eq(agentThreadFollowsTable.serverId, input.serverId),
                          eq(agentThreadFollowsTable.threadChatId, input.chatId),
                          inArray(agentThreadFollowsTable.agentId, agentIds)
                      )
                  )
            : Promise.resolve([]),
    ]);
    const muted = new Set(mutes.map((row) => row.agentId));
    const followByAgent = new Map(follows.map((row) => [row.agentId, row.followed]));
    const mentioned = mentionedAgentIds(input.content, agents);

    if (chat.kind === 'thread') {
        for (const agentId of mentioned) {
            if (agentIds.includes(agentId) && followByAgent.get(agentId) === undefined) {
                await db
                    .insert(agentThreadFollowsTable)
                    .values({
                        agentId,
                        serverId: input.serverId,
                        threadChatId: input.chatId,
                    })
                    .onConflictDoNothing();
                followByAgent.set(agentId, true);
            }
        }
    }

    return agentIds.flatMap((agentId) => {
        const isMentioned = mentioned.has(agentId);
        const isMuted = muted.has(agentId);
        const followed = chat.kind !== 'thread' || followByAgent.get(agentId) === true;
        if (!isMentioned && (isMuted || !followed)) {
            return [];
        }
        return [{ agentId, pierced: isMentioned && (isMuted || !followed) }];
    });
}

function mentionedAgentIds(
    content: string,
    agents: Array<{ handle: string; id: string }>
): Set<string> {
    const ids = new Set(
        parseTavernRichReferences(content).flatMap((reference) => {
            if (reference.kind !== 'agent') {
                return [];
            }
            const id = parseAgentReferenceTarget(reference.id);
            return id ? [id] : [];
        })
    );
    for (const agent of agents) {
        if (
            new RegExp(`(^|\\s)@${escapeRegex(agent.handle)}(?=$|[\\s.,!?;:])`, 'iu').test(content)
        ) {
            ids.add(agent.id);
        }
    }
    return ids;
}

function escapeRegex(value: string) {
    return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
