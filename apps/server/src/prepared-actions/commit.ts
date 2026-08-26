import type { ServerDurableEvent } from '@grotto/api';
import {
    agentCreateActionInputSchema,
    agentCreateActionResultSchema,
    type PreparedActionCommitInput,
    type PreparedActionCommitResult,
} from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import { readAvatarBytes } from '../avatars/avatar-bytes.ts';
import { requireChatWritable } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentActionAttentionsTable,
    chatMessagesTable,
    chatsTable,
    preparedActionMediaTable,
    preparedActionsTable,
} from '../postgres/schema.ts';
import { AgentConfigDeniedError } from '../server-agents/agent-config-errors.ts';
import {
    assertRuntimeModelReported,
    resolveAssignedComputer,
} from '../server-agents/agent-inventory.ts';
import {
    createAgentInTransaction,
    requireAgentCreationAuthority,
} from '../server-agents/create-agent.ts';
import { queryAgents } from '../server-agents/query-agents.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { PreparedActionCommitError } from './commit-errors.ts';
import { insertPreparedActionEvent } from './events.ts';
import { readPreparedAction } from './read.ts';

export interface PreparedActionCommitTransactionResult extends PreparedActionCommitResult {
    event: ServerDurableEvent | null;
}

/**
 * Commits one pending native Agent-creation card. The action, ordinary Agent,
 * Owner DM, avatar copy, event, and PRD-262 handoff row share one transaction.
 */
export async function commitPreparedAction(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: PreparedActionCommitInput
): Promise<PreparedActionCommitTransactionResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireAgentCreationAuthority(tx, member, input.serverId);
        const row = await readCommitRow(tx, input.serverId, input.actionId);

        if (!row) {
            throw new PreparedActionCommitError('That prepared action no longer exists.');
        }
        if (row.action.status === 'executed') {
            return await replayCommit(tx, member, input.serverId, row.action.id);
        }
        if (row.action.status !== 'pending') {
            throw new PreparedActionCommitError('That prepared action is no longer pending.');
        }
        if (row.action.kind !== 'agent:create' || !row.media) {
            throw new PreparedActionCommitError('That prepared action cannot create an Agent.');
        }
        if (row.messageAuthorAgentId !== row.action.proposerAgentId) {
            throw new PreparedActionCommitError('The prepared action Chat anchor is invalid.');
        }

        await requireChatWritable(tx, { chatId: row.action.chatId, serverId: input.serverId });
        const proposal = readProposal(row.action.proposal);
        if (
            proposal.computer?.kind === 'required' &&
            proposal.computer.computerId !== input.computerId
        ) {
            throw new AgentConfigDeniedError(
                `The proposal requires Computer "${proposal.computer.computerId}".`
            );
        }

        const avatar = input.avatar
            ? {
                  ...readAvatarBytes(input.avatar.bytesBase64, input.avatar.mediaType),
                  mediaType: input.avatar.mediaType,
              }
            : {
                  bytes: row.media.bytes,
                  mediaType: row.media.mediaType,
                  sha256: row.media.sha256,
              };
        const { inventory } = await resolveAssignedComputer(tx, {
            computerId: input.computerId,
            serverId: input.serverId,
        });
        assertRuntimeModelReported(inventory, input.runtimeId, input.modelId);

        const created = await createAgentInTransaction(
            tx,
            member,
            {
                avatar: undefined,
                computerId: input.computerId,
                description: input.description,
                displayName: input.displayName,
                handle: input.handle,
                modelId: input.modelId,
                reasoningEffort: input.reasoningEffort,
                role: 'member',
                runtimeId: input.runtimeId,
                serverId: input.serverId,
            },
            avatar
        );
        const result = agentCreateActionResultSchema.parse({
            agentId: created.agent.id,
            avatarUrl: created.agent.avatarUrl,
            computerId: created.agent.computerId,
            description: created.agent.description,
            displayName: created.agent.displayName,
            handle: created.agent.handle,
            modelId: created.agent.desiredModelId,
            reasoningEffort: created.agent.desiredReasoningEffort,
            role: created.agent.role,
            runtimeId: created.agent.desiredRuntimeId,
        });
        const executedAt = new Date();
        await tx
            .update(preparedActionsTable)
            .set({
                executedAt,
                executedByUserId: member?.id ?? null,
                executedResult: result,
                status: 'executed',
            })
            .where(
                and(
                    eq(preparedActionsTable.serverId, input.serverId),
                    eq(preparedActionsTable.id, row.action.id),
                    eq(preparedActionsTable.status, 'pending')
                )
            );
        await tx.insert(agentActionAttentionsTable).values({
            actionId: row.action.id,
            agentId: row.action.proposerAgentId,
            chatId: row.action.chatId,
            createdAgentId: created.agent.id,
            dedupeKey: row.action.id,
            executedResult: result,
            id: createOpaqueId('aat'),
            serverId: input.serverId,
            source: 'action',
        });
        const event = await insertPreparedActionEvent(tx, {
            actionId: row.action.id,
            chat: row.chat,
            chatId: row.action.chatId,
            messageId: row.action.messageId,
            sequence: row.messageSequence,
            serverId: input.serverId,
            status: 'executed',
        });
        const action = await readPreparedAction(tx, input.serverId, row.action.id);
        if (!action) {
            throw new Error('The committed prepared action could not be projected.');
        }
        return { action, agent: created.agent, event, idempotent: false };
    });
}

async function replayCommit(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string,
    actionId: string
): Promise<PreparedActionCommitTransactionResult> {
    const action = await readPreparedAction(db, serverId, actionId);
    const result =
        action?.kind === 'agent:create' ? agentCreateActionResultSchema.parse(action.result) : null;
    if (!(action && result && member)) {
        throw new Error('The executed prepared action has no stored result.');
    }
    const [agent] = await queryAgents(db, member, serverId, result.agentId);
    if (!agent) {
        throw new Error('The executed prepared action result could not be replayed.');
    }
    return { action, agent, event: null, idempotent: true };
}

function readProposal(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new PreparedActionCommitError('The prepared Agent proposal is invalid.');
    }
    const { avatarMediaId: _avatarMediaId, ...proposal } = value as Record<string, unknown>;
    return agentCreateActionInputSchema.parse(proposal);
}

async function readCommitRow(db: GrottoDatabase, serverId: string, actionId: string) {
    const [row] = await db
        .select({
            action: preparedActionsTable,
            chat: {
                kind: chatsTable.kind,
                parentChatId: chatsTable.parentChatId,
            },
            media: preparedActionMediaTable,
            messageAuthorAgentId: chatMessagesTable.authorAgentId,
            messageSequence: chatMessagesTable.sequence,
        })
        .from(preparedActionsTable)
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, preparedActionsTable.serverId),
                eq(chatsTable.id, preparedActionsTable.chatId)
            )
        )
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, preparedActionsTable.serverId),
                eq(chatMessagesTable.chatId, preparedActionsTable.chatId),
                eq(chatMessagesTable.id, preparedActionsTable.messageId)
            )
        )
        .leftJoin(
            preparedActionMediaTable,
            and(
                eq(preparedActionMediaTable.serverId, preparedActionsTable.serverId),
                eq(preparedActionMediaTable.actionId, preparedActionsTable.id)
            )
        )
        .where(
            and(eq(preparedActionsTable.serverId, serverId), eq(preparedActionsTable.id, actionId))
        )
        .for('update', { of: preparedActionsTable });
    return row;
}
