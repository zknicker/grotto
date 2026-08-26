import type { ServerDurableEvent } from '@grotto/api';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable } from '../postgres/schema.ts';

export interface PreparedActionEventChat {
    kind: 'channel' | 'dm' | 'thread';
    parentChatId: string | null;
}

export async function insertMessageCreatedEvent(
    db: GrottoDatabase,
    input: {
        chat: PreparedActionEventChat;
        message: {
            chatId: string;
            id: string;
            sequence: number;
            serverId: string;
            createdAt: Date;
        };
        serverId: string;
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.message.chatId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.message.id,
            sequence: input.message.sequence,
            serverId: input.serverId,
            type: 'message.created',
        })
        .returning({
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
        });
    if (!event) {
        throw new Error('Failed to record the prepared action message event.');
    }
    return {
        chatId: input.message.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: event.cursor.toString(),
        id: event.id,
        messageId: input.message.id,
        parentChatId: input.chat.kind === 'thread' ? input.chat.parentChatId : null,
        sequence: input.message.sequence,
        serverId: input.serverId,
        type: 'message.created',
    };
}

export async function insertPreparedActionEvent(
    db: GrottoDatabase,
    input: {
        actionId: string;
        chat: PreparedActionEventChat;
        chatId: string;
        messageId: string;
        sequence: number;
        serverId: string;
        status: 'pending' | 'superseded' | 'executed';
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            actionId: input.actionId,
            actionStatus: input.status,
            chatId: input.chatId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'prepared-action.updated',
        })
        .returning({
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
        });
    if (!event) {
        throw new Error('Failed to record the prepared action event.');
    }
    return {
        actionId: input.actionId,
        chatId: input.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: event.cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: input.chat.kind === 'thread' ? input.chat.parentChatId : null,
        sequence: input.sequence,
        serverId: input.serverId,
        status: input.status,
        type: 'prepared-action.updated',
    };
}
