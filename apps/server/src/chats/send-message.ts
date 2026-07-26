import type {
    HostedChatMessageReceipt,
    HostedChatSendInput,
    HostedDurableEvent,
} from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    chatEventsTable,
    chatMessagesTable,
    chatsTable,
    threadFollowsTable,
} from '../postgres/schema.ts';
import { ensureHostedThread } from '../threads/ensure-thread.ts';
import { autoFollowHostedThreadMentions } from '../threads/thread-attention.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { allocateHostedEventCursor } from './allocate-event-cursor.ts';
import { requireChatAccess } from './chat-access.ts';
import { toHostedChatMessage } from './message-shape.ts';

export class ChatNonceConflictError extends Error {
    constructor() {
        super('That message nonce already belongs to a different send.');
        this.name = 'ChatNonceConflictError';
    }
}

export class DirectThreadSendError extends Error {
    constructor() {
        super('Thread replies require their parent Chat and anchor message.');
        this.name = 'DirectThreadSendError';
    }
}

export interface SendHostedChatMessageResult {
    event: HostedDurableEvent | null;
    receipt: HostedChatMessageReceipt;
}

export async function sendHostedChatMessage(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedChatSendInput
): Promise<SendHostedChatMessageResult> {
    return await db.transaction(async (tx) => {
        const thread = input.thread
            ? await ensureHostedThread(tx, member, {
                  anchorMessageId: input.thread.anchorMessageId,
                  parentChatId: input.chatId,
                  serverId: input.serverId,
              })
            : null;
        const writeChatId = thread?.id ?? input.chatId;

        const writeChat = await requireChatAccess(tx, member, {
            chatId: writeChatId,
            serverId: input.serverId,
        });

        if (!input.thread && writeChat.kind === 'thread') {
            throw new DirectThreadSendError();
        }

        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${writeChatId}
            for update
        `);

        const [existing] = await tx
            .select({
                authorUserId: chatMessagesTable.authorUserId,
                chatId: chatMessagesTable.chatId,
                content: chatMessagesTable.content,
                createdAt: chatMessagesTable.createdAt,
                eventCursor: chatEventsTable.cursor,
                id: chatMessagesTable.id,
                nonce: chatMessagesTable.nonce,
                sequence: chatMessagesTable.sequence,
                serverId: chatMessagesTable.serverId,
            })
            .from(chatMessagesTable)
            .innerJoin(
                chatEventsTable,
                and(
                    eq(chatEventsTable.serverId, chatMessagesTable.serverId),
                    eq(chatEventsTable.messageId, chatMessagesTable.id),
                    eq(chatEventsTable.type, 'message.created')
                )
            )
            .where(
                and(
                    eq(chatMessagesTable.serverId, input.serverId),
                    eq(chatMessagesTable.chatId, writeChatId),
                    eq(chatMessagesTable.nonce, input.nonce)
                )
            )
            .limit(1);

        if (existing) {
            if (existing.authorUserId !== member?.id || existing.content !== input.content) {
                throw new ChatNonceConflictError();
            }

            return {
                event: null,
                receipt: {
                    eventCursor: existing.eventCursor.toString(),
                    idempotent: true,
                    message: toHostedChatMessage(existing),
                    threadChatId: thread?.id ?? null,
                },
            };
        }

        const [updatedChat] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: sql`now()`,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, writeChatId)))
            .returning({ sequence: chatsTable.lastMessageSequence });

        if (!(updatedChat && member)) {
            throw new Error('Failed to allocate the Chat message sequence.');
        }

        const [message] = await tx
            .insert(chatMessagesTable)
            .values({
                authorUserId: member.id,
                chatId: writeChatId,
                content: input.content,
                id: createOpaqueId('msg'),
                nonce: input.nonce,
                sequence: updatedChat.sequence,
                serverId: input.serverId,
            })
            .returning();

        if (thread) {
            await tx
                .insert(threadFollowsTable)
                .values({
                    serverId: input.serverId,
                    threadChatId: thread.id,
                    userId: member.id,
                })
                .onConflictDoUpdate({
                    set: { followed: true, updatedAt: sql`now()` },
                    target: [
                        threadFollowsTable.serverId,
                        threadFollowsTable.threadChatId,
                        threadFollowsTable.userId,
                    ],
                });
            await autoFollowHostedThreadMentions(tx, {
                content: input.content,
                parentChatId: thread.parentChatId,
                serverId: input.serverId,
                threadChatId: thread.id,
            });
        }

        const eventCursor = await allocateHostedEventCursor(tx, input.serverId);
        const [event] = await tx
            .insert(chatEventsTable)
            .values({
                chatId: writeChatId,
                cursor: eventCursor,
                id: createOpaqueId('evt'),
                messageId: message.id,
                sequence: message.sequence,
                serverId: input.serverId,
                type: 'message.created',
            })
            .returning({
                createdAt: chatEventsTable.createdAt,
                cursor: chatEventsTable.cursor,
                id: chatEventsTable.id,
            });

        return {
            event: {
                chatId: message.chatId,
                createdAt: event.createdAt.toISOString(),
                cursor: event.cursor.toString(),
                id: event.id,
                messageId: message.id,
                parentChatId: thread?.parentChatId ?? null,
                sequence: message.sequence,
                serverId: message.serverId,
                type: 'message.created',
            },
            receipt: {
                eventCursor: event.cursor.toString(),
                idempotent: false,
                message: toHostedChatMessage(message),
                threadChatId: thread?.id ?? null,
            },
        };
    });
}
