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

export async function listAgentMessageRecipients(
    db: GrottoDatabase,
    input: {
        authorAgentId: string | null;
        chatId: string;
        content: string;
        serverId: string;
    }
): Promise<string[]> {
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
        return chat.dmAgentId && chat.dmAgentId !== input.authorAgentId ? [chat.dmAgentId] : [];
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
                ? [parent.dmAgentId]
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
                  .select({ agentId: agentThreadFollowsTable.agentId })
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
    const followed = new Set(follows.map((row) => row.agentId));
    const mentioned = mentionedAgentIds(input.content, agents);

    return agentIds.filter(
        (agentId) =>
            mentioned.has(agentId) ||
            (!muted.has(agentId) && (chat.kind !== 'thread' || followed.has(agentId)))
    );
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
