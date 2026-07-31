import type {
    HostedChatMessageReceipt,
    HostedChatSendInput,
    HostedDurableEvent,
} from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { planAgentMessageRecipients } from '../agent-delivery/message-recipients.ts';
import {
    associateMessageAttachments,
    attachmentMetadata,
    readMessageAttachments,
    requireMessageAttachments,
} from '../attachments/message-attachments.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    chatEventsTable,
    chatMessagesTable,
    chatsTable,
    threadFollowsTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
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

export class RetiredAgentDmSendError extends Error {
    constructor() {
        super(
            'This Agent is retired. You can read this conversation, but you can’t send new messages.'
        );
        this.name = 'RetiredAgentDmSendError';
    }
}

export interface SendHostedChatMessageResult {
    event: HostedDurableEvent | null;
    receipt: HostedChatMessageReceipt;
    /** Agents whose durable pending inbox this send enqueued. */
    wakes: Array<{ agentId: string; serverId: string }>;
}

export async function sendHostedChatMessage(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedChatSendInput,
    agentDelivery: AgentDelivery
): Promise<SendHostedChatMessageResult> {
    return await db.transaction(async (tx) => {
        // Server row first, then authorize: a send that started before a removal
        // must re-read membership behind it rather than commit past it.
        await lockServerRow(tx, input.serverId);

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
        if (!member) {
            throw new Error('A message author is required.');
        }

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
                authorAgentId: chatMessagesTable.authorAgentId,
                authorUserId: chatMessagesTable.authorUserId,
                chatId: chatMessagesTable.chatId,
                content: chatMessagesTable.content,
                createdAt: chatMessagesTable.createdAt,
                eventCursor: chatEventsTable.cursor,
                id: chatMessagesTable.id,
                nonce: chatMessagesTable.nonce,
                sequence: chatMessagesTable.sequence,
                serverId: chatMessagesTable.serverId,
                systemAuthor: chatMessagesTable.systemAuthor,
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
            const existingAttachments =
                (await readMessageAttachments(tx, input.serverId, [existing.id])).get(
                    existing.id
                ) ?? [];
            if (
                existing.authorUserId !== member.id ||
                existing.content !== input.content ||
                !sameIds(
                    existingAttachments.map((attachment) => attachment.id),
                    input.attachmentIds
                )
            ) {
                throw new ChatNonceConflictError();
            }

            return {
                event: null,
                receipt: {
                    eventCursor: existing.eventCursor.toString(),
                    idempotent: true,
                    message: toHostedChatMessage(existing, existingAttachments),
                    threadChatId: thread?.id ?? null,
                },
                wakes: [],
            };
        }

        await requireActiveDmPeer(tx, writeChat);

        const attachments = await requireMessageAttachments(tx, member, {
            attachmentIds: input.attachmentIds,
            chatId: writeChatId,
            serverId: input.serverId,
        });
        const [updatedChat] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: sql`now()`,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, writeChatId)))
            .returning({ sequence: chatsTable.lastMessageSequence });

        if (!updatedChat) {
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

        await associateMessageAttachments(tx, attachments, message.id);
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

        // Plan every Agent recipient under its Server-owned attention state in
        // this same transaction. The wire nudge remains separately recoverable.
        const recipients = await planAgentMessageRecipients(tx, {
            authorAgentId: null,
            chatId: writeChatId,
            content: input.content,
            serverId: input.serverId,
        });
        for (const recipient of recipients) {
            await agentDelivery.enqueue(tx, {
                agentId: recipient.agentId,
                chatId: writeChatId,
                content: input.content,
                dedupeKey: message.id,
                pierced: recipient.pierced,
                sequence: message.sequence,
                serverId: input.serverId,
                source: 'human',
            });
        }

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
                message: toHostedChatMessage(message, attachmentMetadata(attachments)),
                threadChatId: thread?.id ?? null,
            },
            wakes: recipients.map(({ agentId }) => ({ agentId, serverId: input.serverId })),
        };
    });
}

export async function requireActiveDmPeer(
    db: GrottoDatabase,
    chat: {
        dmAgentId: string | null;
        kind: 'channel' | 'dm' | 'thread';
        parentChatId: string | null;
        serverId: string;
    }
) {
    let agentId = chat.kind === 'dm' ? chat.dmAgentId : null;
    if (chat.kind === 'thread' && chat.parentChatId) {
        const [parent] = await db
            .select({ dmAgentId: chatsTable.dmAgentId })
            .from(chatsTable)
            .where(
                and(eq(chatsTable.serverId, chat.serverId), eq(chatsTable.id, chat.parentChatId))
            )
            .limit(1);
        agentId = parent?.dmAgentId ?? null;
    }
    if (!agentId) {
        return;
    }

    const [agent] = await db
        .select({ retiredAt: agentsTable.retiredAt })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, chat.serverId), eq(agentsTable.id, agentId)))
        .limit(1);
    if (!agent || agent.retiredAt) {
        throw new RetiredAgentDmSendError();
    }
}

function sameIds(left: string[], right: string[]) {
    return left.length === right.length && left.every((id, index) => id === right[index]);
}
