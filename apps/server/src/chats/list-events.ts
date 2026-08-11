import type { HostedDurableEvent } from '@tavern/api';
import { and, eq, gt, or, type SQL, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatEventsTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { visibleHostedChats } from './chat-visibility.ts';
import type { HostedChatLifecycleAction } from './lifecycle-events.ts';

export async function listHostedChatEvents(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { afterCursor: string; limit: number; serverId: string }
): Promise<HostedDurableEvent[]> {
    await requireServerMembership(db, member, input.serverId);

    if (!member) {
        return [];
    }

    const rows = await db
        .select({
            chatAction: chatEventsTable.chatAction,
            chatId: chatEventsTable.chatId,
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
            labelId: chatEventsTable.labelId,
            lifecycleChatId: chatEventsTable.lifecycleChatId,
            messageId: chatEventsTable.messageId,
            parentChatId: chatsTable.parentChatId,
            reminderAction: chatEventsTable.reminderAction,
            reminderId: chatEventsTable.reminderId,
            sequence: chatEventsTable.sequence,
            serverId: chatEventsTable.serverId,
            type: chatEventsTable.type,
        })
        .from(chatEventsTable)
        .leftJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, chatEventsTable.serverId),
                eq(chatsTable.id, chatEventsTable.chatId)
            )
        )
        .where(
            and(
                eq(chatEventsTable.serverId, input.serverId),
                gt(chatEventsTable.cursor, BigInt(input.afterCursor)),
                or(
                    eq(chatEventsTable.type, 'task.label.updated'),
                    and(
                        eq(chatEventsTable.type, 'chat.lifecycle'),
                        replayableLifecycleChat(member.id)
                    ),
                    and(
                        or(
                            // Participant-gated like live delivery; the operator-scoped
                            // reminder lane (reminder.changes) owns cross-chat replay.
                            eq(chatEventsTable.type, 'reminder.changed'),
                            eq(chatEventsTable.type, 'message.created'),
                            eq(chatEventsTable.type, 'task.created'),
                            eq(chatEventsTable.type, 'task.updated'),
                            and(
                                or(
                                    eq(chatEventsTable.type, 'chat.read'),
                                    eq(chatEventsTable.type, 'thread.follow.updated')
                                ),
                                eq(chatEventsTable.readerUserId, member.id)
                            )
                        ),
                        visibleHostedChats(member.id)
                    )
                )
            )
        )
        .orderBy(chatEventsTable.cursor)
        .limit(input.limit);

    return rows.map((event) => {
        const common = {
            createdAt: event.createdAt.toISOString(),
            cursor: event.cursor.toString(),
            id: event.id,
            serverId: event.serverId,
        };

        if (event.type === 'task.label.updated') {
            return {
                ...common,
                chatId: null,
                labelId: event.labelId as string,
                parentChatId: null,
                sequence: 0 as const,
                type: 'task.label.updated' as const,
            };
        }

        if (event.type === 'chat.lifecycle') {
            return {
                ...common,
                action: event.chatAction as HostedChatLifecycleAction,
                chatId: event.lifecycleChatId as string,
                parentChatId: null,
                sequence: 0 as const,
                type: 'chat.lifecycle' as const,
            };
        }

        if (event.type === 'message.created') {
            return {
                ...common,
                chatId: event.chatId as string,
                messageId: event.messageId as string,
                parentChatId: event.parentChatId,
                sequence: event.sequence,
                type: 'message.created' as const,
            };
        }

        if (event.type === 'task.created' || event.type === 'task.updated') {
            return {
                ...common,
                chatId: event.chatId as string,
                messageId: event.messageId as string,
                parentChatId: null,
                sequence: event.sequence,
                type: event.type,
            };
        }

        if (event.type === 'chat.read') {
            return {
                ...common,
                chatId: event.chatId as string,
                parentChatId: event.parentChatId,
                sequence: event.sequence,
                type: 'chat.read' as const,
            };
        }

        if (event.type === 'reminder.changed') {
            return {
                ...common,
                action: event.reminderAction as
                    | 'canceled'
                    | 'fired'
                    | 'scheduled'
                    | 'snoozed'
                    | 'updated',
                chatId: event.chatId as string,
                parentChatId: event.parentChatId,
                reminderId: event.reminderId as string,
                sequence: event.sequence,
                type: 'reminder.changed' as const,
            };
        }

        return {
            ...common,
            chatId: event.chatId as string,
            parentChatId: event.parentChatId as string,
            sequence: event.sequence,
            type: 'thread.follow.updated' as const,
        };
    });
}

/**
 * Lifecycle events keep their Chat id outside the live Chat foreign key, so
 * replay checks visibility directly: a member replays one while the Chat is
 * still visible to them, or once the row is gone because a delete purged it.
 * Without this a private DM's `created` event would replay to every member.
 */
function replayableLifecycleChat(userId: string): SQL {
    return sql`(
        not exists (
            select 1
            from chats lifecycle_chat
            where lifecycle_chat.server_id = ${chatEventsTable.serverId}
                and lifecycle_chat.id = ${chatEventsTable.lifecycleChatId}
        )
        or exists (
            select 1
            from chats
            where ${chatsTable.serverId} = ${chatEventsTable.serverId}
                and ${chatsTable.id} = ${chatEventsTable.lifecycleChatId}
                and ${visibleHostedChats(userId)}
        )
    )`;
}
