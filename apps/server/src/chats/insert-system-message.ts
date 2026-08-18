import type { ServerDurableEvent } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';
import { allocateEventCursor } from './allocate-event-cursor.ts';

export type SystemMessageAuthor = 'reminder' | 'session' | 'task';

type SystemMessageWriter = Pick<GrottoDatabase, 'insert' | 'update'>;

/**
 * Persists one Server-authored timeline message and its durable message.created event.
 * Callers own the surrounding transaction and any domain-specific copy or idempotency.
 */
export async function insertSystemMessage(
    db: SystemMessageWriter,
    input: {
        chatId: string;
        content: string;
        createdAt?: Date;
        nonce: string;
        serverId: string;
        systemAuthor: SystemMessageAuthor;
    }
): Promise<Extract<ServerDurableEvent, { type: 'message.created' }>> {
    const createdAt = input.createdAt ?? new Date();
    const [chat] = await db
        .update(chatsTable)
        .set({
            // Assignment receipts are private Agent communication. They
            // consume Chat sequence space for ordering, but must not move a
            // human Chat to the top of the App or create a visible activity
            // cue.
            ...(input.systemAuthor === 'task' ? {} : { lastActivityAt: createdAt }),
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

    const cursor = await allocateEventCursor(db, input.serverId);
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
