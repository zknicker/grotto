import type { TavernAgentMessage } from '@tavern/api';
import { and, asc, desc, eq, gt, ilike, lt, sql } from 'drizzle-orm';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatMessagesTable,
    chatsTable,
} from '../postgres/schema.ts';
import {
    messageSelection,
    targetForChat,
    toAgentMessages,
    visibleChatSql,
} from './message-view.ts';
import { AgentTargetError, resolveAgentTarget } from './resolve-target.ts';

export async function readAgentHistory(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: {
        after?: string;
        around?: string;
        before?: string;
        limit: number;
        target: string;
    }
) {
    const chatId = await resolveAgentTarget(db, runner, input.target);
    const anchor = input.after ?? input.before ?? input.around;
    const anchorSequence = anchor
        ? await resolveSequence(db, runner.serverId, chatId, anchor)
        : null;
    const rows = await db
        .select(messageSelection)
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                eq(chatMessagesTable.chatId, chatId),
                input.after && anchorSequence !== null
                    ? gt(chatMessagesTable.sequence, anchorSequence)
                    : undefined,
                input.before && anchorSequence !== null
                    ? lt(chatMessagesTable.sequence, anchorSequence)
                    : undefined,
                input.around && anchorSequence !== null
                    ? and(
                          gt(
                              chatMessagesTable.sequence,
                              Math.max(0, anchorSequence - Math.floor(input.limit / 2) - 1)
                          ),
                          lt(
                              chatMessagesTable.sequence,
                              anchorSequence + Math.ceil(input.limit / 2) + 1
                          )
                      )
                    : undefined
            )
        )
        .orderBy(
            input.before || !anchor
                ? desc(chatMessagesTable.sequence)
                : asc(chatMessagesTable.sequence)
        )
        .limit(input.limit + 1);
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    if (input.before || !anchor) {
        page.reverse();
    }
    return {
        has_more: hasMore,
        has_newer: Boolean(input.before),
        has_older: hasMore || Boolean(input.after),
        last_read: { after: 0, unread_after: -1 },
        messages: await toAgentMessages(db, runner.serverId, page),
        target: input.target,
    };
}

export async function resolveAgentMessage(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    id: string
): Promise<TavernAgentMessage> {
    const rows = await db
        .select(messageSelection)
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                id.startsWith('msg_')
                    ? eq(chatMessagesTable.id, id)
                    : ilike(chatMessagesTable.id, `msg_${escapeLike(id)}%`)
            )
        )
        .limit(2);
    if (rows.length !== 1) {
        throw new AgentTargetError(
            rows.length === 0 ? 'That message does not exist.' : 'That message id is ambiguous.'
        );
    }
    await requireAgentChatAccess(db, runner, rows[0].chatId);
    return (await toAgentMessages(db, runner.serverId, rows))[0];
}

export async function searchAgentMessages(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: {
        after?: Date;
        before?: Date;
        limit: number;
        offset: number;
        query: string;
        sender?: string;
        sort: 'recent' | 'relevance';
        target?: string;
    }
): Promise<(TavernAgentMessage & { target: string })[]> {
    const targetChatId = input.target
        ? await resolveAgentTarget(db, runner, input.target)
        : undefined;
    const rows = await db
        .select(messageSelection)
        .from(chatMessagesTable)
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, chatMessagesTable.serverId),
                eq(chatsTable.id, chatMessagesTable.chatId)
            )
        )
        .leftJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, chatMessagesTable.serverId),
                eq(agentsTable.id, chatMessagesTable.authorAgentId)
            )
        )
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                targetChatId ? eq(chatMessagesTable.chatId, targetChatId) : visibleChatSql(runner),
                sql`${chatMessagesTable.searchVector}
                    @@ websearch_to_tsquery('simple', ${input.query})`,
                input.sender ? eq(agentsTable.handle, stripAt(input.sender)) : undefined,
                input.after ? gt(chatMessagesTable.createdAt, input.after) : undefined,
                input.before ? lt(chatMessagesTable.createdAt, input.before) : undefined
            )
        )
        .orderBy(
            input.sort === 'relevance'
                ? desc(
                      sql`ts_rank(${chatMessagesTable.searchVector},
                          websearch_to_tsquery('simple', ${input.query}))`
                  )
                : desc(chatMessagesTable.createdAt),
            desc(chatMessagesTable.id)
        )
        .offset(input.offset)
        .limit(input.limit);
    const messages = await toAgentMessages(db, runner.serverId, rows);
    return await Promise.all(
        messages.map(async (message) => ({
            ...message,
            target: await targetForChat(db, runner.serverId, message.chat_id),
        }))
    );
}

export async function requireAgentChatAccess(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string
): Promise<void> {
    const [chat] = await db
        .select({
            dmAgentId: chatsTable.dmAgentId,
            id: chatsTable.id,
            kind: chatsTable.kind,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, chatId)))
        .limit(1);
    if (!chat) {
        throw new AgentTargetError();
    }
    if (chat.kind === 'dm' && chat.dmAgentId === runner.agentId) {
        return;
    }
    const channelId = chat.kind === 'thread' ? chat.parentChatId : chat.id;
    if (channelId) {
        const [joined] = await db
            .select({ agentId: channelAgentParticipantsTable.agentId })
            .from(channelAgentParticipantsTable)
            .where(
                and(
                    eq(channelAgentParticipantsTable.serverId, runner.serverId),
                    eq(channelAgentParticipantsTable.chatId, channelId),
                    eq(channelAgentParticipantsTable.agentId, runner.agentId)
                )
            )
            .limit(1);
        if (joined) {
            return;
        }
    }
    throw new AgentTargetError();
}

async function resolveSequence(
    db: GrottoDatabase,
    serverId: string,
    chatId: string,
    anchor: string
): Promise<number> {
    if (/^\d+$/u.test(anchor)) {
        return Number(anchor);
    }
    const [message] = await db
        .select({ sequence: chatMessagesTable.sequence })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, serverId),
                eq(chatMessagesTable.chatId, chatId),
                anchor.startsWith('msg_')
                    ? eq(chatMessagesTable.id, anchor)
                    : ilike(chatMessagesTable.id, `msg_${escapeLike(anchor)}%`)
            )
        )
        .limit(1);
    if (!message) {
        throw new AgentTargetError('That history anchor does not exist in this target.');
    }
    return message.sequence;
}

function escapeLike(value: string) {
    return value.replaceAll(/[\\%_]/gu, '\\$&');
}

function stripAt(value: string) {
    return value.startsWith('@') ? value.slice(1) : value;
}
