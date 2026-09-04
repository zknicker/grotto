import type { ServerDurableEvent } from '@grotto/api';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable } from '../postgres/schema.ts';

export interface AskEventChat {
    kind: 'channel' | 'dm' | 'thread';
    parentChatId: string | null;
}

/**
 * The durable notification for one Ask lifecycle change. Clients refetch the
 * Message and the open-Ask list; the event itself carries only identities.
 */
export async function insertAskEvent(
    db: Pick<GrottoDatabase, 'insert' | 'update'>,
    input: {
        askId: string;
        chat: AskEventChat;
        chatId: string;
        messageId: string;
        sequence: number;
        serverId: string;
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            askId: input.askId,
            chatId: input.chatId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'ask.updated',
        })
        .returning({
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
        });
    if (!event) {
        throw new Error('Failed to record the Ask event.');
    }
    return {
        askId: input.askId,
        chatId: input.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: event.cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: input.chat.kind === 'thread' ? input.chat.parentChatId : null,
        sequence: input.sequence,
        serverId: input.serverId,
        type: 'ask.updated',
    };
}
