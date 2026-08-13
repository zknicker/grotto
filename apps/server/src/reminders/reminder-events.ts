import type { ServerDurableEvent } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatsTable } from '../postgres/schema.ts';

export type ReminderEventAction = 'canceled' | 'fired' | 'scheduled' | 'snoozed' | 'updated';

export async function insertReminderChangedEvent(
    db: GrottoDatabase,
    input: {
        action: ReminderEventAction;
        chatId: string;
        createdAt: Date;
        parentChatId: string | null;
        reminderId: string;
        sequence: number;
        serverId: string;
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            createdAt: input.createdAt,
            cursor,
            id: createOpaqueId('evt'),
            reminderAction: input.action,
            reminderId: input.reminderId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'reminder.changed',
        })
        .returning({ id: chatEventsTable.id });
    return {
        action: input.action,
        chatId: input.chatId,
        createdAt: input.createdAt.toISOString(),
        cursor: cursor.toString(),
        id: event.id,
        parentChatId: input.parentChatId,
        reminderId: input.reminderId,
        sequence: input.sequence,
        serverId: input.serverId,
        type: 'reminder.changed',
    };
}

export async function insertAnchoredReminderChangedEvent(
    db: GrottoDatabase,
    input: {
        action: ReminderEventAction;
        chatId: string;
        createdAt: Date;
        reminderId: string;
        serverId: string;
    }
) {
    const [chat] = await db
        .select({
            parentChatId: chatsTable.parentChatId,
            sequence: chatsTable.lastMessageSequence,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);
    if (!chat) {
        throw new Error('The reminder anchor Chat no longer exists.');
    }
    return insertReminderChangedEvent(db, {
        ...input,
        parentChatId: chat.parentChatId,
        sequence: chat.sequence,
    });
}
