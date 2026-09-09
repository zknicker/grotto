import type { ServerDurableEvent } from '@grotto/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable } from '../postgres/schema.ts';
import { allocateEventCursor } from './allocate-event-cursor.ts';

export async function insertMessageReactionEvent(
    db: Pick<GrottoDatabase, 'insert' | 'update'>,
    input: {
        chatId: string;
        messageId: string;
        parentChatId: string | null;
        sequence: number;
        serverId: string;
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'message.reaction.updated',
        })
        .returning({
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
        });

    if (!event) {
        throw new Error('Failed to record the Message reaction event.');
    }

    return {
        chatId: input.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: event.cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: input.parentChatId,
        sequence: input.sequence,
        serverId: input.serverId,
        type: 'message.reaction.updated',
    };
}
