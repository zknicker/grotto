import { parseTavernRichReferences, parseUserReferenceTarget } from '@tavern/api';
import { and, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { visibleChats } from '../chats/chat-visibility.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    chatMessagesTable,
    chatReadsTable,
    chatsTable,
    serverMembershipsTable,
    threadFollowsTable,
} from '../postgres/schema.ts';

export async function autoFollowThreadMentions(
    db: GrottoDatabase,
    input: { content: string; parentChatId: string; serverId: string; threadChatId: string }
) {
    const mentionedUserIds = directMentionedUserIds(input.content);

    for (const userId of mentionedUserIds) {
        const [eligible] = await db
            .select({ id: serverMembershipsTable.userId })
            .from(serverMembershipsTable)
            .innerJoin(
                chatsTable,
                and(
                    eq(chatsTable.serverId, serverMembershipsTable.serverId),
                    eq(chatsTable.id, input.parentChatId)
                )
            )
            .where(
                and(
                    eq(serverMembershipsTable.serverId, input.serverId),
                    eq(serverMembershipsTable.userId, userId),
                    isNull(serverMembershipsTable.revokedAt),
                    visibleChats(userId)
                )
            )
            .limit(1);

        if (!eligible) {
            continue;
        }

        await db
            .insert(threadFollowsTable)
            .values({
                serverId: input.serverId,
                threadChatId: input.threadChatId,
                userId,
            })
            .onConflictDoNothing();
    }
}

export async function readThreadAttentionCounts(
    db: GrottoDatabase,
    input: { parentChatIds: string[]; readerUserId: string; serverId: string }
) {
    const counts = new Map<string, number>();

    if (input.parentChatIds.length === 0) {
        return counts;
    }

    const threads = await db
        .select({ id: chatsTable.id, parentChatId: chatsTable.parentChatId })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                eq(chatsTable.kind, 'thread'),
                inArray(chatsTable.parentChatId, input.parentChatIds)
            )
        );
    const threadIds = threads.map((thread) => thread.id);

    if (threadIds.length === 0) {
        return counts;
    }

    const messages = await db
        .select({
            chatId: chatMessagesTable.chatId,
            content: chatMessagesTable.content,
            followed: threadFollowsTable.followed,
        })
        .from(chatMessagesTable)
        .leftJoin(
            chatReadsTable,
            and(
                eq(chatReadsTable.serverId, chatMessagesTable.serverId),
                eq(chatReadsTable.chatId, chatMessagesTable.chatId),
                eq(chatReadsTable.readerUserId, input.readerUserId)
            )
        )
        .leftJoin(
            threadFollowsTable,
            and(
                eq(threadFollowsTable.serverId, chatMessagesTable.serverId),
                eq(threadFollowsTable.threadChatId, chatMessagesTable.chatId),
                eq(threadFollowsTable.userId, input.readerUserId)
            )
        )
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                inArray(chatMessagesTable.chatId, threadIds),
                or(
                    isNull(chatMessagesTable.authorUserId),
                    ne(chatMessagesTable.authorUserId, input.readerUserId)
                ),
                gt(chatMessagesTable.sequence, sql<number>`coalesce(${chatReadsTable.sequence}, 0)`)
            )
        );
    const parentByThread = new Map(
        threads.map((thread) => [thread.id, thread.parentChatId as string])
    );

    for (const message of messages) {
        const attended =
            message.followed === true ||
            directMentionedUserIds(message.content).includes(input.readerUserId);

        if (!attended) {
            continue;
        }

        const parentChatId = parentByThread.get(message.chatId) as string;
        counts.set(parentChatId, (counts.get(parentChatId) ?? 0) + 1);
    }

    return counts;
}

function directMentionedUserIds(content: string) {
    return [
        ...new Set(
            parseTavernRichReferences(content).flatMap((reference) => {
                if (reference.kind !== 'user') {
                    return [];
                }
                const userId = parseUserReferenceTarget(reference.id);
                return userId ? [userId] : [];
            })
        ),
    ];
}
