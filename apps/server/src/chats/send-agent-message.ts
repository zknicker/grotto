import type { HostedAgentSendReceipt, HostedDurableEvent } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { allocateHostedEventCursor } from './allocate-event-cursor.ts';

export interface SendHostedAgentMessageInput {
    agentId: string;
    chatId: string;
    content: string;
    nonce: string;
    serverId: string;
    /** The grammar target the Agent believes it answered; recorded for fidelity. */
    target: string;
}

export interface SendHostedAgentMessageResult {
    event: HostedDurableEvent | null;
    receipt: HostedAgentSendReceipt;
}

/**
 * Writes one durable Agent-authored message into the runner's bound chat. The
 * runner credential already fixed the author and channel, so this trusts those
 * ids and only guards idempotency by `(chat, nonce)` — a redriven send after a
 * lost receipt returns the original message instead of duplicating it.
 */
export async function sendHostedAgentMessage(
    db: GrottoDatabase,
    input: SendHostedAgentMessageInput
): Promise<SendHostedAgentMessageResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${input.chatId}
            for update
        `);

        const [existing] = await tx
            .select({
                authorAgentId: chatMessagesTable.authorAgentId,
                content: chatMessagesTable.content,
                cursor: chatEventsTable.cursor,
                id: chatMessagesTable.id,
                sequence: chatMessagesTable.sequence,
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
                    eq(chatMessagesTable.chatId, input.chatId),
                    eq(chatMessagesTable.nonce, input.nonce)
                )
            )
            .limit(1);

        if (existing) {
            if (existing.authorAgentId !== input.agentId || existing.content !== input.content) {
                throw new AgentSendConflictError();
            }
            return {
                event: null,
                receipt: {
                    chatId: input.chatId,
                    idempotent: true,
                    messageId: existing.id,
                    sequence: existing.sequence,
                    target: input.target,
                },
            };
        }

        const [updatedChat] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: sql`now()`,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
            .returning({ sequence: chatsTable.lastMessageSequence });
        if (!updatedChat) {
            throw new Error('Failed to allocate the Agent message sequence.');
        }

        const [message] = await tx
            .insert(chatMessagesTable)
            .values({
                authorAgentId: input.agentId,
                chatId: input.chatId,
                content: input.content,
                id: createOpaqueId('msg'),
                nonce: input.nonce,
                sequence: updatedChat.sequence,
                serverId: input.serverId,
            })
            .returning();

        const eventCursor = await allocateHostedEventCursor(tx, input.serverId);
        const [event] = await tx
            .insert(chatEventsTable)
            .values({
                chatId: input.chatId,
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
                chatId: input.chatId,
                createdAt: event.createdAt.toISOString(),
                cursor: event.cursor.toString(),
                id: event.id,
                messageId: message.id,
                parentChatId: null,
                sequence: message.sequence,
                serverId: input.serverId,
                type: 'message.created',
            },
            receipt: {
                chatId: input.chatId,
                idempotent: false,
                messageId: message.id,
                sequence: message.sequence,
                target: input.target,
            },
        };
    });
}

export class AgentSendConflictError extends Error {
    constructor() {
        super('That message nonce already belongs to a different Agent send.');
        this.name = 'AgentSendConflictError';
    }
}
