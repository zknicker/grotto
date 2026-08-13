import type { ServerDurableEvent } from '@tavern/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable } from '../postgres/schema.ts';
import { allocateEventCursor } from './allocate-event-cursor.ts';

export type ChatLifecycleAction = 'archived' | 'created' | 'deleted' | 'unarchived' | 'updated';

/**
 * The one writer of `chat.lifecycle` rows. The Chat id lives in
 * `lifecycle_chat_id`, outside the live Chat foreign key, so a `deleted`
 * notification survives the purge that follows it.
 */
export async function insertLifecycleEvent(
    db: GrottoDatabase,
    input: { chatId: string; serverId: string },
    action: ChatLifecycleAction,
    createdAt: Date
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatAction: action,
            createdAt,
            cursor,
            id: createOpaqueId('evt'),
            lifecycleChatId: input.chatId,
            sequence: 0,
            serverId: input.serverId,
            type: 'chat.lifecycle',
        })
        .returning({ id: chatEventsTable.id });

    return {
        action,
        chatId: input.chatId,
        createdAt: createdAt.toISOString(),
        cursor: cursor.toString(),
        id: event.id,
        parentChatId: null,
        sequence: 0,
        serverId: input.serverId,
        type: 'chat.lifecycle',
    };
}
