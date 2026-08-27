import type {
    AgentActivityEvent,
    AgentSendReceipt,
    AttachmentMetadata,
    GrottoAgentMessage,
    ServerDurableEvent,
} from '@grotto/api';
import { and, eq, sql } from 'drizzle-orm';
import { followAgentThread } from '../agent-api/attention.ts';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { planAgentMessageRecipients } from '../agent-delivery/message-recipients.ts';
import {
    associateMessageAttachments,
    attachmentMetadata,
    readMessageAttachments,
    requireAgentMessageAttachments,
} from '../attachments/message-attachments.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable, chatEventsTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';
import { appendServerAgentActivity } from '../server-agents/agent-activity.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { autoFollowThreadMentions } from '../threads/thread-attention.ts';
import { allocateEventCursor } from './allocate-event-cursor.ts';
import { canonicalizeAgentMessageContentForPersistence } from './canonicalize-agent-references.ts';
import { requireChatWritable } from './chat-access.ts';

const maxAgentMessageContentLength = 32_000;

export interface SendAgentMessageInput {
    agentId: string;
    attachmentIds: string[];
    chatId: string;
    content: string;
    nonce: string;
    runId: string;
    serverId: string;
    /** The grammar target the Agent believes it answered; recorded for fidelity. */
    target: string;
}

export interface SendAgentMessageResult {
    activities: AgentActivityEvent[];
    event: ServerDurableEvent | null;
    message: GrottoAgentMessage;
    receipt: AgentSendReceipt;
    wakes: Array<{ agentId: string; serverId: string }>;
}

/**
 * Writes one durable Agent-authored message into the Server-resolved target.
 * The runner credential fixes the author and Server; the Agent API resolves the
 * grammar target and access before calling here. Idempotency is `(chat, nonce)`.
 */
export async function sendAgentMessage(
    db: GrottoDatabase,
    input: SendAgentMessageInput,
    agentDelivery: AgentDelivery
): Promise<SendAgentMessageResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${input.chatId}
            for update
        `);
        await requireChatWritable(tx, input);
        const [agent] = await tx
            .select({
                description: agentsTable.description,
                displayName: agentsTable.displayName,
                handle: agentsTable.handle,
            })
            .from(agentsTable)
            .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
            .limit(1);
        if (!agent) {
            throw new Error('The Agent no longer exists.');
        }

        const [existing] = await tx
            .select({
                authorAgentId: chatMessagesTable.authorAgentId,
                content: chatMessagesTable.content,
                createdAt: chatMessagesTable.createdAt,
                cursor: chatEventsTable.cursor,
                id: chatMessagesTable.id,
                nonce: chatMessagesTable.nonce,
                runId: chatMessagesTable.runId,
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
        const content =
            existing?.content === input.content
                ? input.content
                : await canonicalizeAgentMessageContentForPersistence(tx, {
                      content: input.content,
                      existingContent: existing?.content,
                      serverId: input.serverId,
                  });
        if (content.length > maxAgentMessageContentLength) {
            throw new AgentMessageContentTooLongError();
        }

        if (existing) {
            const existingAttachments =
                (await readMessageAttachments(tx, input.serverId, [existing.id])).get(
                    existing.id
                ) ?? [];
            if (
                existing.authorAgentId !== input.agentId ||
                existing.content !== content ||
                existingAttachments.map(({ id }) => id).join('\0') !==
                    input.attachmentIds.join('\0')
            ) {
                throw new AgentSendConflictError();
            }
            return {
                activities: [],
                event: null,
                message: toAgentCliMessage(existing, {
                    ...agent,
                    agentId: input.agentId,
                    attachments: existingAttachments,
                    chatId: input.chatId,
                }),
                receipt: {
                    chatId: input.chatId,
                    idempotent: true,
                    messageId: existing.id,
                    sequence: existing.sequence,
                    target: input.target,
                },
                wakes: [],
            };
        }
        const activities: AgentActivityEvent[] = [];
        const startedActivity = await appendServerAgentActivity(tx, {
            agentId: input.agentId,
            category: 'sending_message',
            phase: 'started',
            runId: input.runId,
            serverId: input.serverId,
        });
        if (startedActivity) {
            activities.push(startedActivity);
        }
        const attachments = await requireAgentMessageAttachments(tx, input.agentId, {
            attachmentIds: input.attachmentIds,
            chatId: input.chatId,
            serverId: input.serverId,
        });

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
                content,
                id: createOpaqueId('msg'),
                nonce: input.nonce,
                runId: input.runId,
                sequence: updatedChat.sequence,
                serverId: input.serverId,
            })
            .returning();
        await associateMessageAttachments(tx, attachments, message.id, input.chatId);

        const [writtenChat] = await tx
            .select({ kind: chatsTable.kind, parentChatId: chatsTable.parentChatId })
            .from(chatsTable)
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
            .limit(1);
        if (writtenChat?.kind === 'thread') {
            await followAgentThread(tx, {
                agentId: input.agentId,
                serverId: input.serverId,
                threadChatId: input.chatId,
            });
            if (writtenChat.parentChatId) {
                await autoFollowThreadMentions(tx, {
                    content,
                    parentChatId: writtenChat.parentChatId,
                    serverId: input.serverId,
                    threadChatId: input.chatId,
                });
            }
        }
        const recipients = await planAgentMessageRecipients(tx, {
            authorAgentId: input.agentId,
            chatId: input.chatId,
            content,
            serverId: input.serverId,
        });
        for (const recipient of recipients) {
            await agentDelivery.enqueue(tx, {
                agentId: recipient.agentId,
                chatId: input.chatId,
                content,
                dedupeKey: message.id,
                mentioned: recipient.mentioned,
                sequence: message.sequence,
                serverId: input.serverId,
                source: `agent:${agent.handle}`,
                threadFollowReactivated: recipient.threadFollowReactivated,
            });
        }

        const eventCursor = await allocateEventCursor(tx, input.serverId);
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

        const completedActivity = await appendServerAgentActivity(tx, {
            agentId: input.agentId,
            category: 'sending_message',
            phase: 'completed',
            runId: input.runId,
            serverId: input.serverId,
        });
        if (completedActivity) {
            activities.push(completedActivity);
        }

        return {
            activities,
            event: {
                chatId: input.chatId,
                createdAt: event.createdAt.toISOString(),
                cursor: event.cursor.toString(),
                id: event.id,
                messageId: message.id,
                parentChatId: writtenChat?.kind === 'thread' ? writtenChat.parentChatId : null,
                sequence: message.sequence,
                serverId: input.serverId,
                type: 'message.created',
            },
            message: toAgentCliMessage(message, {
                ...agent,
                agentId: input.agentId,
                attachments: attachmentMetadata(attachments),
                chatId: input.chatId,
            }),
            receipt: {
                chatId: input.chatId,
                idempotent: false,
                messageId: message.id,
                sequence: message.sequence,
                target: input.target,
            },
            wakes: recipients.map(({ agentId }) => ({ agentId, serverId: input.serverId })),
        };
    });
}

function toAgentCliMessage(
    message: {
        content: string;
        createdAt: Date;
        id: string;
        nonce: string;
        sequence: number;
    },
    agent: {
        agentId: string;
        attachments: AttachmentMetadata[];
        chatId: string;
        description: string | null;
        displayName: string;
        handle: string;
    }
): GrottoAgentMessage {
    return {
        attachments: agent.attachments,
        author: {
            id: agent.agentId,
            kind: 'agent',
            label: agent.displayName,
            metadata: {},
        },
        chat_id: agent.chatId,
        content: message.content,
        created_at: message.createdAt.toISOString(),
        deleted_at: null,
        delivery_id: null,
        id: message.id,
        metadata: {},
        nonce: message.nonce,
        role: 'assistant',
        sender: { description: agent.description, handle: agent.handle, type: 'agent' },
        sequence: message.sequence,
    };
}

export class AgentSendConflictError extends Error {
    constructor() {
        super('That message nonce already belongs to a different Agent send.');
        this.name = 'AgentSendConflictError';
    }
}

export class AgentMessageContentTooLongError extends Error {
    constructor() {
        super('The message is too long after rich references are resolved.');
        this.name = 'AgentMessageContentTooLongError';
    }
}
