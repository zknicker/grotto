import type { HostedThreadSummary } from '@tavern/api';
import { and, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    chatMessagesTable,
    chatReadsTable,
    chatsTable,
    threadFollowsTable,
} from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

/** How many replies the anchor's preview block shows before "N replies ›". */
const threadPreviewReplyCount = 3;

export async function listHostedThreadSummaries(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { anchorMessageIds: string[]; parentChatId?: string; serverId: string }
): Promise<HostedThreadSummary[]> {
    if (!(member && input.anchorMessageIds.length > 0)) {
        return [];
    }

    const threads = await db
        .select({
            anchorMessageId: chatsTable.anchorMessageId,
            id: chatsTable.id,
        })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                eq(chatsTable.kind, 'thread'),
                ...(input.parentChatId ? [eq(chatsTable.parentChatId, input.parentChatId)] : []),
                inArray(chatsTable.anchorMessageId, input.anchorMessageIds)
            )
        );
    const threadIds = threads.map((thread) => thread.id);

    if (threadIds.length === 0) {
        return [];
    }

    const [messages, reads, follows] = await Promise.all([
        db
            .select({
                authorAgentId: chatMessagesTable.authorAgentId,
                authorUserId: chatMessagesTable.authorUserId,
                chatId: chatMessagesTable.chatId,
                content: chatMessagesTable.content,
                createdAt: chatMessagesTable.createdAt,
                id: chatMessagesTable.id,
                sequence: chatMessagesTable.sequence,
            })
            .from(chatMessagesTable)
            .where(
                and(
                    eq(chatMessagesTable.serverId, input.serverId),
                    inArray(chatMessagesTable.chatId, threadIds)
                )
            ),
        db
            .select({ chatId: chatReadsTable.chatId, sequence: chatReadsTable.sequence })
            .from(chatReadsTable)
            .where(
                and(
                    eq(chatReadsTable.serverId, input.serverId),
                    eq(chatReadsTable.readerUserId, member.id),
                    inArray(chatReadsTable.chatId, threadIds)
                )
            ),
        db
            .select({
                followed: threadFollowsTable.followed,
                threadChatId: threadFollowsTable.threadChatId,
            })
            .from(threadFollowsTable)
            .where(
                and(
                    eq(threadFollowsTable.serverId, input.serverId),
                    eq(threadFollowsTable.userId, member.id),
                    inArray(threadFollowsTable.threadChatId, threadIds)
                )
            ),
    ]);
    const readByThread = new Map(reads.map((read) => [read.chatId, read.sequence]));
    const followByThread = new Map(follows.map((follow) => [follow.threadChatId, follow.followed]));

    return threads.map((thread) => {
        const replies = messages
            .filter((message) => message.chatId === thread.id)
            .sort((left, right) => left.sequence - right.sequence);
        const readSequence = readByThread.get(thread.id) ?? 0;
        const latestReply = replies.reduce<Date | null>(
            (latest, reply) => (!latest || reply.createdAt > latest ? reply.createdAt : latest),
            null
        );

        return {
            anchorMessageId: thread.anchorMessageId as string,
            followed: followByThread.get(thread.id) ?? false,
            latestReplyAt: latestReply?.toISOString() ?? null,
            recentReplies: replies.slice(-threadPreviewReplyCount).map((reply) => ({
                authorAgentId: reply.authorAgentId,
                authorUserId: reply.authorUserId,
                content: reply.content,
                createdAt: reply.createdAt.toISOString(),
                id: reply.id,
            })),
            replyCount: replies.length,
            threadChatId: thread.id,
            unreadCount: replies.filter(
                (reply) => reply.authorUserId !== member.id && reply.sequence > readSequence
            ).length,
        };
    });
}
