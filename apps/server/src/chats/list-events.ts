import type { HostedDurableEvent } from '@tavern/api';
import { and, eq, gt, or } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatEventsTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { visibleHostedChats } from './chat-visibility.ts';

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
            chatId: chatEventsTable.chatId,
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
            messageId: chatEventsTable.messageId,
            parentChatId: chatsTable.parentChatId,
            reminderAction: chatEventsTable.reminderAction,
            reminderId: chatEventsTable.reminderId,
            sequence: chatEventsTable.sequence,
            serverId: chatEventsTable.serverId,
            type: chatEventsTable.type,
        })
        .from(chatEventsTable)
        .innerJoin(
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
                    eq(chatEventsTable.type, 'message.created'),
                    eq(chatEventsTable.type, 'reminder.changed'),
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
        .orderBy(chatEventsTable.cursor)
        .limit(input.limit);

    return rows.map((event) => {
        const common = {
            chatId: event.chatId,
            createdAt: event.createdAt.toISOString(),
            cursor: event.cursor.toString(),
            id: event.id,
            parentChatId: event.parentChatId,
            sequence: event.sequence,
            serverId: event.serverId,
        };

        if (event.type === 'message.created') {
            return {
                ...common,
                messageId: event.messageId as string,
                type: 'message.created' as const,
            };
        }

        if (event.type === 'chat.read') {
            return { ...common, type: 'chat.read' as const };
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
                reminderId: event.reminderId as string,
                type: 'reminder.changed' as const,
            };
        }

        return {
            ...common,
            parentChatId: event.parentChatId as string,
            type: 'thread.follow.updated' as const,
        };
    });
}
