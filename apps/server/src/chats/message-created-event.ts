import type { ServerDurableEvent } from '@grotto/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable } from '../postgres/schema.ts';
import { allocateEventCursor } from './allocate-event-cursor.ts';

/** The Chat a durable event names, and the parent it reports for a Thread. */
export interface DurableEventChat {
    kind: 'channel' | 'dm' | 'thread';
    parentChatId: string | null;
}

export async function insertMessageCreatedEvent(
    db: Pick<GrottoDatabase, 'insert' | 'update'>,
    input: {
        chat: DurableEventChat;
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
        throw new Error('Failed to record the Chat message event.');
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
