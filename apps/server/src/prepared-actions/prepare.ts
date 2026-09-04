import { createHash } from 'node:crypto';
import type {
    AgentActionPrepareReceipt,
    AgentCreateActionInput,
    ServerDurableEvent,
} from '@grotto/api';
import { and, eq, sql } from 'drizzle-orm';
import { followAgentThread } from '../agent-api/attention.ts';
import { resolveAgentTarget } from '../agent-api/resolve-target.ts';
import { readAgentSessionGeneration } from '../agent-delivery/cursors.ts';
import { planAgentMessageRecipients } from '../agent-delivery/message-recipients.ts';
import { requireChatWritable } from '../chats/chat-access.ts';
import { insertMessageCreatedEvent } from '../chats/message-created-event.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    preparedActionMediaTable,
    preparedActionsTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { insertPreparedActionEvent } from './events.ts';
import { assertFreshAgentView } from './freshness.ts';
import { assertIdempotentProposal, readActionByNonce } from './idempotency.ts';
import { readPreparedAction } from './read.ts';
import { supersedePendingPreparedActions } from './supersession.ts';

export { PreparedActionConflictError, PreparedActionStaleViewError } from './errors.ts';

export interface PreparedActionAvatarBytes {
    bytes: Uint8Array;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface PrepareAgentActionInput {
    action: AgentCreateActionInput;
    avatar: PreparedActionAvatarBytes;
    nonce: string;
    target: string;
}

interface PreparedActionTransactionInput extends PrepareAgentActionInput {
    chatId: string;
    runId: string;
    serverId: string;
}

export interface PrepareAgentActionResult {
    events: ServerDurableEvent[];
    receipt: AgentActionPrepareReceipt;
    wakes: Array<{ agentId: string; serverId: string }>;
}

/**
 * Writes an Agent-prepared action and its Chat anchor under one Server lock.
 * The action row and media row are immutable after this function returns; a
 * correction is a new row that records the supersession of its predecessor.
 */
export async function prepareAgentAction(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: PrepareAgentActionInput,
    agentDelivery: import('../agent-delivery/delivery.ts').AgentDelivery
): Promise<PrepareAgentActionResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const chatId = await resolveAgentTarget(tx, runner, input.target);
        return await prepareAgentActionInTransaction(
            tx,
            runner,
            {
                ...input,
                chatId,
                runId: runner.runId,
                serverId: runner.serverId,
            },
            agentDelivery
        );
    });
}

async function prepareAgentActionInTransaction(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: PreparedActionTransactionInput,
    agentDelivery: import('../agent-delivery/delivery.ts').AgentDelivery
): Promise<PrepareAgentActionResult> {
    await requireChatWritable(db, { chatId: input.chatId, serverId: input.serverId });

    const existing = await readActionByNonce(db, runner, input.nonce);
    if (existing) {
        await assertIdempotentProposal(db, existing, input);
        const action = await readPreparedAction(db, input.serverId, existing.id);
        if (!action) {
            throw new Error('The idempotent prepared action disappeared.');
        }
        return {
            events: [],
            receipt: {
                action,
                chatId: existing.chatId,
                idempotent: true,
                messageId: existing.messageId,
                sequence: existing.sequence,
                target: input.target,
            },
            wakes: [],
        };
    }

    await assertFreshAgentView(db, runner, input.chatId);

    const [agent] = await db
        .select({ handle: agentsTable.handle })
        .from(agentsTable)
        .where(
            and(
                eq(agentsTable.serverId, runner.serverId),
                eq(agentsTable.id, runner.agentId),
                sql`${agentsTable.retiredAt} is null`
            )
        )
        .limit(1);
    if (!agent) {
        throw new Error('The preparing Agent no longer exists.');
    }

    const [chat] = await db
        .select({ kind: chatsTable.kind, parentChatId: chatsTable.parentChatId })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);
    if (!chat) {
        throw new Error('The target Chat no longer exists.');
    }

    const actionId = createOpaqueId('act');
    const mediaId = createOpaqueId('pam');
    const previous = await supersedePendingPreparedActions(
        db,
        {
            chatId: input.chatId,
            kind: 'agent:create',
            proposerAgentId: runner.agentId,
            serverId: input.serverId,
        },
        actionId
    );

    const [updatedChat] = await db
        .update(chatsTable)
        .set({
            lastActivityAt: sql`now()`,
            lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
        })
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .returning({ sequence: chatsTable.lastMessageSequence });
    if (!updatedChat) {
        throw new Error('Failed to allocate the prepared action message sequence.');
    }

    const [message] = await db
        .insert(chatMessagesTable)
        .values({
            authorAgentId: runner.agentId,
            chatId: input.chatId,
            // The native card is the complete presentation. Keeping the
            // anchor body empty prevents a second model-authored form.
            content: '',
            id: createOpaqueId('msg'),
            nonce: input.nonce,
            runId: runner.runId,
            sequence: updatedChat.sequence,
            serverId: input.serverId,
            sessionGeneration: await readAgentSessionGeneration(db, runner.agentId),
        })
        .returning();
    if (!message) {
        throw new Error('Failed to create the prepared action Chat anchor.');
    }

    await db.insert(preparedActionsTable).values({
        chatId: input.chatId,
        id: actionId,
        kind: 'agent:create',
        messageId: message.id,
        nonce: input.nonce,
        proposal: { ...input.action, avatarMediaId: mediaId },
        proposerAgentId: runner.agentId,
        serverId: input.serverId,
    });
    await db.insert(preparedActionMediaTable).values({
        actionId,
        byteSize: input.avatar.bytes.byteLength,
        bytes: input.avatar.bytes,
        id: mediaId,
        mediaType: input.avatar.mediaType,
        sha256: createHash('sha256').update(input.avatar.bytes).digest('hex'),
        serverId: input.serverId,
    });

    if (chat.kind === 'thread') {
        await followAgentThread(db, {
            agentId: runner.agentId,
            serverId: input.serverId,
            threadChatId: input.chatId,
        });
    }

    const recipients = await planAgentMessageRecipients(db, {
        authorAgentId: runner.agentId,
        chatId: input.chatId,
        content: '',
        serverId: input.serverId,
    });
    for (const recipient of recipients) {
        await agentDelivery.enqueue(db, {
            agentId: recipient.agentId,
            chatId: input.chatId,
            content: '',
            dedupeKey: message.id,
            mentioned: recipient.mentioned,
            sequence: message.sequence,
            serverId: input.serverId,
            source: `agent:${agent.handle}`,
            threadFollowReactivated: recipient.threadFollowReactivated,
        });
    }

    const events: ServerDurableEvent[] = [];
    for (const oldAction of previous) {
        events.push(
            await insertPreparedActionEvent(db, {
                actionId: oldAction.id,
                chat,
                chatId: input.chatId,
                messageId: oldAction.messageId,
                sequence: oldAction.sequence,
                serverId: input.serverId,
                status: 'superseded',
            })
        );
    }
    events.push(await insertMessageCreatedEvent(db, { chat, message, serverId: input.serverId }));
    events.push(
        await insertPreparedActionEvent(db, {
            actionId,
            chat,
            chatId: input.chatId,
            messageId: message.id,
            sequence: message.sequence,
            serverId: input.serverId,
            status: 'pending',
        })
    );

    const action = await readPreparedAction(db, input.serverId, actionId);
    if (!action) {
        throw new Error('The prepared action could not be projected after creation.');
    }
    return {
        events,
        receipt: {
            action,
            chatId: input.chatId,
            idempotent: false,
            messageId: message.id,
            sequence: message.sequence,
            target: input.target,
        },
        wakes: recipients.map(({ agentId }) => ({ agentId, serverId: input.serverId })),
    };
}
