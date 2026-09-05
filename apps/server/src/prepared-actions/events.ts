import type { ServerDurableEvent } from '@grotto/api';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { DurableEventChat } from '../chats/message-created-event.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable } from '../postgres/schema.ts';

export async function insertPreparedActionEvent(
    db: GrottoDatabase,
    input: {
        actionId: string;
        chat: DurableEventChat;
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
