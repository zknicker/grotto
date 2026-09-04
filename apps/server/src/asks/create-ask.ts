import type { AgentAskInput, AgentAskReceipt, ServerDurableEvent } from '@grotto/api';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { followAgentThread } from '../agent-api/attention.ts';
import { resolveAgentSendTarget } from '../agent-api/resolve-target.ts';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { planAgentMessageRecipients } from '../agent-delivery/message-recipients.ts';
import { findChatAccess, requireChatWritable } from '../chats/chat-access.ts';
import { insertMessageCreatedEvent } from '../chats/message-created-event.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    asksTable,
    chatMessagesTable,
    chatsTable,
    serverMembershipsTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { ensureThreadRecord } from '../threads/ensure-thread.ts';
import { autoFollowThreadMentions } from '../threads/thread-attention.ts';
import { insertAskEvent } from './ask-events.ts';
import { findAskByMessage } from './ask-shape.ts';
import { AskAgentNotFoundError, AskConflictError, InvalidAskAddresseeError } from './errors.ts';

export interface CreateAskResult {
    events: ServerDurableEvent[];
    receipt: AgentAskReceipt;
    wakes: Array<{ agentId: string; serverId: string }>;
}

/**
 * Writes one Ask: the Agent-authored Message, the Ask record, the deterministic
 * child Thread when the Ask is top-level, ordinary delivery planning, and the
 * durable events — all in one transaction, idempotent by the message nonce.
 * Every check runs before the first write, so an ineligible addressee or an
 * unreachable target creates nothing.
 */
export async function createAsk(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: AgentAskInput,
    agentDelivery: AgentDelivery
): Promise<CreateAskResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const chatId = await resolveAgentSendTarget(tx, runner, input.target);
        await requireChatWritable(tx, { chatId, serverId: runner.serverId });

        const existing = await readAskByNonce(tx, runner, chatId, input);
        if (existing) {
            return { events: [], receipt: existing, wakes: [] };
        }

        const agent = await requireAskingAgent(tx, runner);
        const addresseeUserId = await resolveAddressee(tx, runner.serverId, chatId, input);
        const chat = await requireAskChat(tx, runner.serverId, chatId);

        const [numbered] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: sql`now()`,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, chatId)))
            .returning({ sequence: chatsTable.lastMessageSequence });
        if (!numbered) {
            throw new Error('Failed to allocate the Ask message sequence.');
        }

        const [message] = await tx
            .insert(chatMessagesTable)
            .values({
                authorAgentId: runner.agentId,
                bodyKind: 'ask',
                chatId,
                content: input.content,
                id: createOpaqueId('msg'),
                nonce: input.nonce,
                runId: runner.runId,
                sequence: numbered.sequence,
                serverId: runner.serverId,
            })
            .returning();

        const askId = createOpaqueId('ask');
        await tx.insert(asksTable).values({
            addresseeUserId,
            agentId: runner.agentId,
            chatId,
            id: askId,
            messageId: message.id,
            recommendedStep: input.recommendedStep,
            serverId: runner.serverId,
            summary: input.summary,
            title: input.title,
        });

        // A top-level Ask receives its child Thread immediately; an Ask posted
        // inside a Thread stays there, because Threads do not nest. Either way
        // the asking Agent follows the conversation the answer arrives in.
        const answerThreadChatId =
            chat.kind === 'thread'
                ? chatId
                : (
                      await ensureThreadRecord(tx, {
                          anchorMessageId: message.id,
                          parentChatId: chatId,
                          serverId: runner.serverId,
                      })
                  ).id;
        await followAgentThread(tx, {
            agentId: runner.agentId,
            serverId: runner.serverId,
            threadChatId: answerThreadChatId,
        });
        if (chat.kind === 'thread' && chat.parentChatId) {
            await autoFollowThreadMentions(tx, {
                content: input.content,
                parentChatId: chat.parentChatId,
                serverId: runner.serverId,
                threadChatId: chatId,
            });
        }

        const recipients = await planAgentMessageRecipients(tx, {
            authorAgentId: runner.agentId,
            chatId,
            content: input.content,
            serverId: runner.serverId,
        });
        for (const recipient of recipients) {
            await agentDelivery.enqueue(tx, {
                agentId: recipient.agentId,
                chatId,
                content: input.content,
                dedupeKey: message.id,
                mentioned: recipient.mentioned,
                sequence: message.sequence,
                serverId: runner.serverId,
                source: `agent:${agent.handle}`,
                threadFollowReactivated: recipient.threadFollowReactivated,
            });
        }

        const events = [
            await insertMessageCreatedEvent(tx, { chat, message, serverId: runner.serverId }),
            await insertAskEvent(tx, {
                askId,
                chat,
                chatId,
                messageId: message.id,
                sequence: message.sequence,
                serverId: runner.serverId,
            }),
        ];
        const ask = await findAskByMessage(tx, runner.serverId, message.id);
        if (!ask) {
            throw new Error('The Ask could not be projected after creation.');
        }

        return {
            events,
            receipt: {
                ask,
                chatId,
                idempotent: false,
                messageId: message.id,
                sequence: message.sequence,
                target: input.target,
            },
            wakes: recipients.map(({ agentId }) => ({ agentId, serverId: runner.serverId })),
        };
    });
}

async function readAskByNonce(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    input: AgentAskInput
): Promise<AgentAskReceipt | null> {
    const [message] = await db
        .select({
            authorAgentId: chatMessagesTable.authorAgentId,
            content: chatMessagesTable.content,
            id: chatMessagesTable.id,
            sequence: chatMessagesTable.sequence,
        })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                eq(chatMessagesTable.chatId, chatId),
                eq(chatMessagesTable.nonce, input.nonce)
            )
        )
        .limit(1);
    if (!message) {
        return null;
    }
    const ask = await findAskByMessage(db, runner.serverId, message.id);
    if (
        !ask ||
        message.authorAgentId !== runner.agentId ||
        message.content !== input.content ||
        ask.title !== input.title ||
        ask.summary !== input.summary ||
        ask.recommendedStep !== input.recommendedStep
    ) {
        throw new AskConflictError();
    }
    return {
        ask,
        chatId,
        idempotent: true,
        messageId: message.id,
        sequence: message.sequence,
        target: input.target,
    };
}

async function requireAskingAgent(db: GrottoDatabase, runner: ResolvedRunner) {
    const [agent] = await db
        .select({ handle: agentsTable.handle })
        .from(agentsTable)
        .where(
            and(
                eq(agentsTable.serverId, runner.serverId),
                eq(agentsTable.id, runner.agentId),
                isNull(agentsTable.retiredAt)
            )
        )
        .limit(1);
    if (!agent) {
        throw new AskAgentNotFoundError();
    }
    return agent;
}

/**
 * Humans and Agents share one case-insensitive handle namespace, so an Agent
 * handle simply finds no membership here and fails closed.
 */
async function resolveAddressee(
    db: GrottoDatabase,
    serverId: string,
    chatId: string,
    input: AgentAskInput
): Promise<string> {
    const [member] = await db
        .select({ userId: serverMembershipsTable.userId })
        .from(serverMembershipsTable)
        .where(
            and(
                eq(serverMembershipsTable.serverId, serverId),
                sql`lower(${serverMembershipsTable.handle}) = lower(${input.addresseeHandle})`,
                isNull(serverMembershipsTable.revokedAt)
            )
        )
        .limit(1);
    if (!member) {
        throw new InvalidAskAddresseeError();
    }
    if (!(await findChatAccess(db, member.userId, { chatId, serverId }))) {
        throw new InvalidAskAddresseeError();
    }
    return member.userId;
}

async function requireAskChat(db: GrottoDatabase, serverId: string, chatId: string) {
    const [chat] = await db
        .select({ kind: chatsTable.kind, parentChatId: chatsTable.parentChatId })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), eq(chatsTable.id, chatId)))
        .limit(1);
    if (!chat) {
        throw new Error('The target Chat no longer exists.');
    }
    return chat;
}
