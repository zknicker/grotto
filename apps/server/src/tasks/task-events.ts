import type { ServerDurableEvent } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatMessagesTable } from '../postgres/schema.ts';

type TaskEventWriter = Pick<GrottoDatabase, 'insert' | 'select' | 'update'>;

export async function insertTaskEvent(
    db: TaskEventWriter,
    input: {
        chatId: string;
        messageId: string;
        serverId: string;
        type: 'task.created' | 'task.updated';
    }
): Promise<ServerDurableEvent> {
    const [message] = await db
        .select({ sequence: chatMessagesTable.sequence })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                eq(chatMessagesTable.id, input.messageId)
            )
        )
        .limit(1);
    if (!message) {
        throw new Error('The task event message does not exist.');
    }
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: message.sequence,
            serverId: input.serverId,
            type: input.type,
        })
        .returning({ createdAt: chatEventsTable.createdAt, id: chatEventsTable.id });

    return {
        chatId: input.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: null,
        sequence: message.sequence,
        serverId: input.serverId,
        type: input.type,
    };
}
