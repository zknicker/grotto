import type { HostedDurableEvent } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';
import { allocateHostedEventCursor } from './allocate-event-cursor.ts';

export type HostedSystemMessageAuthor = 'reminder' | 'session';

type SystemMessageWriter = Pick<GrottoDatabase, 'insert' | 'update'>;

/**
 * Persists one Server-authored timeline message and its durable message.created event.
 * Callers own the surrounding transaction and any domain-specific copy or idempotency.
 */
export async function insertHostedSystemMessage(
    db: SystemMessageWriter,
    input: {
        chatId: string;
        content: string;
        createdAt?: Date;
        nonce: string;
        serverId: string;
        systemAuthor: HostedSystemMessageAuthor;
    }
): Promise<HostedDurableEvent> {
    const createdAt = input.createdAt ?? new Date();
    const [chat] = await db
        .update(chatsTable)
        .set({
            lastActivityAt: createdAt,
            lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
        })
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .returning({
            parentChatId: chatsTable.parentChatId,
            sequence: chatsTable.lastMessageSequence,
        });
    if (!chat) {
        throw new Error('Failed to allocate the system message sequence.');
    }

    const messageId = createOpaqueId('msg');
    await db.insert(chatMessagesTable).values({
        chatId: input.chatId,
        content: input.content,
        createdAt,
        id: messageId,
        nonce: input.nonce,
        sequence: chat.sequence,
        serverId: input.serverId,
        systemAuthor: input.systemAuthor,
    });

    const cursor = await allocateHostedEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            createdAt,
            cursor,
            id: createOpaqueId('evt'),
            messageId,
            sequence: chat.sequence,
            serverId: input.serverId,
            type: 'message.created',
        })
        .returning({ createdAt: chatEventsTable.createdAt, id: chatEventsTable.id });

    return {
        chatId: input.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: cursor.toString(),
        id: event.id,
        messageId,
        parentChatId: chat.parentChatId,
        sequence: chat.sequence,
        serverId: input.serverId,
        type: 'message.created',
    };
}
