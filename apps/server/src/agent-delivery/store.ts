import type { AgentReasoningEffort } from '@grotto/api';
import { and, eq, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentActionAttentionsTable,
    agentDeliveryTable,
    agentInboxTable,
    agentsTable,
    chatMessagesTable,
    messageTasksTable,
} from '../postgres/schema.ts';
import { concreteInboxSources } from './inbox-lanes.ts';

export interface AgentDeliveryRow {
    acceptedAt: Date | null;
    activeRunChatId: string | null;
    activeRunComputerId: string | null;
    activeRunId: string | null;
    activeRunModelId: string | null;
    activeRunReasoningEffort: AgentReasoningEffort | null;
    activeRunRuntimeId: string | null;
    agentChainTurns: number;
    agentId: string;
    consecutiveFailures: number;
    retryAfter: Date | null;
    serverId: string;
    stopped: boolean;
}

export interface InboxItemRow {
    chatId: string;
    content: string;
    createdAt: Date;
    dedupeKey: string;
    id: string;
    mentioned: boolean;
    noticeRunId: string | null;
    serverId: string;
    source: string;
    threadFollowReactivated: boolean;
}

export interface AgentDispatchConfig {
    agentDescription: string | null;
    agentDisplayName: string;
    agentName: string;
    computerId: string | null;
    desiredModelId: string | null;
    desiredReasoningEffort: AgentReasoningEffort;
    desiredRuntimeId: string | null;
    factoryAppliedAt: Date | null;
    factoryKind: 'cove' | 'ordinary';
    homeTimezone: string;
    retiredAt: Date | null;
    sessionGeneration: number;
    sessionResetKind: 'full' | 'session';
}

/** The Agent's assigned Computer and desired runtime/model, or nulls when unconfigured. */
export async function readAgentDispatchConfig(
    db: GrottoDatabase,
    agentId: string
): Promise<AgentDispatchConfig | null> {
    const [row] = await db
        .select({
            agentDescription: agentsTable.description,
            agentDisplayName: agentsTable.displayName,
            agentName: agentsTable.handle,
            computerId: agentsTable.computerId,
            desiredModelId: agentsTable.desiredModelId,
            desiredReasoningEffort: agentsTable.desiredReasoningEffort,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            factoryAppliedAt: agentsTable.factoryAppliedAt,
            factoryKind: agentsTable.factoryKind,
            homeTimezone: agentsTable.homeTimezone,
            retiredAt: agentsTable.retiredAt,
            sessionGeneration: agentsTable.sessionGeneration,
            sessionResetKind: agentsTable.sessionResetKind,
        })
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
    return row ?? null;
}

export async function readAgentServerId(
    db: GrottoDatabase,
    agentId: string
): Promise<string | null> {
    const [row] = await db
        .select({ serverId: agentsTable.serverId })
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
    return row?.serverId ?? null;
}

export async function readDeliveryState(
    db: GrottoDatabase,
    agentId: string
): Promise<AgentDeliveryRow | null> {
    const [row] = await db
        .select()
        .from(agentDeliveryTable)
        .where(eq(agentDeliveryTable.agentId, agentId))
        .limit(1);
    return row ?? null;
}

/** Creates the Agent's delivery row if it has none. Idempotent. */
export async function ensureDeliveryState(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string }
): Promise<void> {
    await db
        .insert(agentDeliveryTable)
        .values({ agentId: input.agentId, serverId: input.serverId })
        .onConflictDoNothing({ target: agentDeliveryTable.agentId });
}

export async function setStopped(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string; stopped: boolean }
): Promise<void> {
    await ensureDeliveryState(db, input);
    await db
        .update(agentDeliveryTable)
        .set({ stopped: input.stopped, updatedAt: new Date() })
        .where(eq(agentDeliveryTable.agentId, input.agentId));
}

/**
 * Records one inbox item, ignoring a duplicate delivery of the same
 * message: the `(server, agent, dedupeKey)` uniqueness makes a re-emitted wake
 * a no-op instead of a second inbox row.
 */
export async function enqueueInboxItem(
    db: GrottoDatabase,
    input: {
        agentId: string;
        chatId: string;
        content: string;
        createdAt?: Date;
        dedupeKey: string;
        mentioned?: boolean;
        serverId: string;
        source: string;
        threadFollowReactivated?: boolean;
    }
): Promise<void> {
    await db
        .insert(agentInboxTable)
        .values({
            agentId: input.agentId,
            chatId: input.chatId,
            content: input.content,
            ...(input.createdAt ? { createdAt: input.createdAt } : {}),
            dedupeKey: input.dedupeKey,
            id: createOpaqueId('inb'),
            mentioned: input.mentioned ?? false,
            serverId: input.serverId,
            source: input.source,
            threadFollowReactivated: input.threadFollowReactivated ?? false,
        })
        .onConflictDoNothing();
}

/** Materializes PRD-261 terminal attentions into the ordinary durable Agent queue. */
export async function materializeActionAttentions(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string }
): Promise<void> {
    const attentions = await db
        .select({
            actionId: agentActionAttentionsTable.actionId,
            chatId: agentActionAttentionsTable.chatId,
            createdAt: agentActionAttentionsTable.createdAt,
        })
        .from(agentActionAttentionsTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, agentActionAttentionsTable.serverId),
                eq(agentsTable.id, agentActionAttentionsTable.agentId)
            )
        )
        .where(
            and(
                eq(agentActionAttentionsTable.serverId, input.serverId),
                eq(agentActionAttentionsTable.agentId, input.agentId),
                isNull(agentsTable.retiredAt)
            )
        );
    for (const attention of attentions) {
        await enqueueInboxItem(db, {
            agentId: input.agentId,
            chatId: attention.chatId,
            content: '',
            createdAt: attention.createdAt,
            dedupeKey: attention.actionId,
            serverId: input.serverId,
            source: 'action',
        });
    }
}

export async function countQueuedInboxItems(db: GrottoDatabase, agentId: string): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agentInboxTable)
        .where(queuedFor(agentId));
    return row?.total ?? 0;
}

export async function countQueuedMessageItems(
    db: GrottoDatabase,
    agentId: string
): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agentInboxTable)
        .where(
            and(
                queuedFor(agentId),
                ne(agentInboxTable.source, 'onboarding'),
                ne(agentInboxTable.source, 'action')
            )
        );
    return row?.total ?? 0;
}

/** Counts work represented by a notice; concrete onboarding work is not notice-only. */
export async function countQueuedNoticeItems(db: GrottoDatabase, agentId: string): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agentInboxTable)
        .where(and(queuedFor(agentId), ne(agentInboxTable.source, 'onboarding')));
    return row?.total ?? 0;
}

/**
 * Associates an explicit in-turn pull with the accepted run that received it.
 * Settlement can then advance `seen` for the pulled rows, while an unsettled
 * run keeps them durable and replayable under the same run id.
 */
export async function attachQueuedItemsToRun(
    db: GrottoDatabase,
    input: { agentId: string; itemIds: string[]; runId: string }
): Promise<void> {
    if (input.itemIds.length === 0) {
        return;
    }
    await db
        .update(agentInboxTable)
        .set({ runId: input.runId, state: 'accepted' })
        .where(and(queuedFor(input.agentId), inArray(agentInboxTable.id, input.itemIds)));
}

/** Records the Computer ack for every row already attached to the acknowledged run. */
async function markInboxItemsAccepted(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentInboxTable)
        .set({ acceptedAt: new Date() })
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                eq(agentInboxTable.runId, input.runId),
                isNull(agentInboxTable.acceptedAt)
            )
        );
}

/**
 * Concrete work is served when the Computer accepts its model-visible run
 * inbox: an action attention, an automation fire, or a task assignment rides
 * in the run's own prompt, so acceptance already put its body in front of the
 * model and no pull can add anything.
 */
async function markConcreteItemsServed(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentInboxTable)
        .set({ servedAt: new Date(), state: 'served' })
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                eq(agentInboxTable.runId, input.runId),
                inArray(agentInboxTable.source, [...concreteInboxSources]),
                eq(agentInboxTable.state, 'accepted'),
                isNull(agentInboxTable.servedAt)
            )
        );
}

/**
 * Records that exact attached rows were handed to the model during the run. A
 * pull only reaches an accepted run, so a row attached after the ack takes its
 * acceptance stamp here rather than losing it.
 */
export async function markInboxItemsServed(
    db: GrottoDatabase,
    input: { agentId: string; itemIds: string[]; runId: string }
): Promise<void> {
    if (input.itemIds.length === 0) {
        return;
    }
    const now = new Date();
    await db
        .update(agentInboxTable)
        .set({
            acceptedAt: sql`coalesce(${agentInboxTable.acceptedAt}, ${now})`,
            servedAt: now,
            state: 'served',
        })
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                eq(agentInboxTable.runId, input.runId),
                ne(agentInboxTable.state, 'seen'),
                inArray(agentInboxTable.id, input.itemIds)
            )
        );
}

export async function listInboxItemsForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                eq(agentInboxTable.runId, input.runId),
                ne(agentInboxTable.state, 'seen')
            )
        )
        .orderBy(...inboxOrder());
}

export async function listQueuedItems(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(queuedFor(agentId))
        .orderBy(...inboxOrder())
        .limit(limit);
}

/** Concrete work stays eligible for a concrete continuation after a busy notice. */
export async function listQueuedConcreteItems(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(and(queuedFor(agentId), inArray(agentInboxTable.source, [...concreteInboxSources])))
        .orderBy(...inboxOrder())
        .limit(limit);
}

export async function listNoticedItemsForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(and(queuedFor(input.agentId), eq(agentInboxTable.startNoticeRunId, input.runId)))
        .orderBy(...inboxOrder());
}

export async function listOfferedItemsForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(and(queuedFor(input.agentId), eq(agentInboxTable.noticeRunId, input.runId)))
        .orderBy(...inboxOrder());
}

export async function listInboxItemsByDedupeKeys(
    db: GrottoDatabase,
    input: { agentId: string; dedupeKeys: string[]; runId: string }
): Promise<InboxItemRow[]> {
    if (input.dedupeKeys.length === 0) {
        return [];
    }
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                inArray(agentInboxTable.dedupeKey, input.dedupeKeys),
                or(
                    and(isNull(agentInboxTable.runId), eq(agentInboxTable.state, 'queued')),
                    eq(agentInboxTable.runId, input.runId)
                )
            )
        );
}

/** Delivery effects that have not yet reached the model in this run. */
export async function listUnservedThreadFollowReactivationIds(
    db: GrottoDatabase,
    input: { agentId: string; dedupeKeys: string[]; runId: string }
): Promise<string[]> {
    if (input.dedupeKeys.length === 0) {
        return [];
    }
    const rows = await db
        .select({ dedupeKey: agentInboxTable.dedupeKey })
        .from(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                inArray(agentInboxTable.dedupeKey, input.dedupeKeys),
                eq(agentInboxTable.threadFollowReactivated, true),
                isNull(agentInboxTable.servedAt),
                or(
                    and(isNull(agentInboxTable.runId), eq(agentInboxTable.state, 'queued')),
                    eq(agentInboxTable.runId, input.runId)
                )
            )
        );
    return rows.map((row) => row.dedupeKey);
}

/** Ordinary Chat rows queryable through the Agent message surfaces. */
export async function listQueuedMessageItems(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(
            and(
                queuedFor(agentId),
                ne(agentInboxTable.source, 'onboarding'),
                ne(agentInboxTable.source, 'action')
            )
        )
        .orderBy(...inboxOrder())
        .limit(limit);
}

/** Marks exact queued identities as offered to the current turn, without making bodies visible. */
export async function markInboxItemsNoticed(
    db: GrottoDatabase,
    input: { agentId: string; initial?: boolean; itemIds: string[]; runId: string }
): Promise<void> {
    if (input.itemIds.length === 0) {
        return;
    }
    await db
        .update(agentInboxTable)
        .set({
            noticeRunId: input.runId,
            ...(input.initial ? { startNoticeRunId: input.runId } : {}),
        })
        .where(and(queuedFor(input.agentId), inArray(agentInboxTable.id, input.itemIds)));
}

/**
 * Returns still-queued typed work to the drain after the run it was offered to
 * settles. A deferred Chat message stays deferred: the model was told about it
 * and can still read it from Chat history, so re-driving would spin. A typed
 * delivery — an automation fire, a task assignment — exists nowhere but this
 * row, so a run that ended without pulling it must not bury it. The run that
 * was *started* for the row keeps its notice, which bounds the redelivery at
 * one dedicated wake per identity.
 */
export async function releaseUnservedTypedItems(
    db: GrottoDatabase,
    input: { agentId: string; runId: string; serverId: string }
): Promise<void> {
    await db.execute(sql`
        update agent_inbox item
        set notice_run_id = null, start_notice_run_id = null
        where item.server_id = ${input.serverId}
          and item.agent_id = ${input.agentId}
          and item.state = 'queued'
          and item.run_id is null
          and item.served_at is null
          and item.notice_run_id = ${input.runId}
          and item.start_notice_run_id is distinct from ${input.runId}
          and not exists (
              select 1 from chat_messages message
              where message.server_id = item.server_id
                and message.id = item.dedupe_key
          )
    `);
}

/**
 * Drops queued work whose typed identity is gone — a deleted Trigger's fires, a
 * canceled Reminder's. The envelope lives only in this row, so nothing else
 * could retire it and it would be re-offered on every wake forever.
 */
export async function retireQueuedItemsByDedupeKeys(
    db: GrottoDatabase,
    input: { dedupeKeys: string[]; serverId: string }
): Promise<void> {
    if (input.dedupeKeys.length === 0) {
        return;
    }
    await db
        .delete(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.serverId, input.serverId),
                eq(agentInboxTable.state, 'queued'),
                isNull(agentInboxTable.runId),
                inArray(agentInboxTable.dedupeKey, input.dedupeKeys)
            )
        );
}

export async function clearInboxNotices(
    db: GrottoDatabase,
    input: { agentId: string; runId?: string }
): Promise<void> {
    await db
        .update(agentInboxTable)
        .set({ noticeRunId: null, startNoticeRunId: null })
        .where(
            and(
                queuedFor(input.agentId),
                input.runId ? eq(agentInboxTable.noticeRunId, input.runId) : undefined
            )
        );
}

export async function listUnnoticedQueuedItems(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<InboxItemRow[]> {
    return await db
        .select({
            chatId: agentInboxTable.chatId,
            content: agentInboxTable.content,
            createdAt: agentInboxTable.createdAt,
            dedupeKey: agentInboxTable.dedupeKey,
            id: agentInboxTable.id,
            mentioned: agentInboxTable.mentioned,
            noticeRunId: agentInboxTable.noticeRunId,
            serverId: agentInboxTable.serverId,
            source: agentInboxTable.source,
            threadFollowReactivated: agentInboxTable.threadFollowReactivated,
        })
        .from(agentInboxTable)
        .where(and(queuedFor(agentId), isNull(agentInboxTable.noticeRunId)))
        .orderBy(...inboxOrder())
        .limit(limit);
}

export async function deleteQueuedOrdinaryItems(
    db: GrottoDatabase,
    input: { agentId: string; chatIds: string[]; serverId: string }
): Promise<void> {
    if (input.chatIds.length === 0) {
        return;
    }
    await db.delete(agentInboxTable).where(
        and(
            queuedFor(input.agentId),
            eq(agentInboxTable.serverId, input.serverId),
            inArray(agentInboxTable.chatId, input.chatIds),
            eq(agentInboxTable.mentioned, false),
            // Only Chat chatter is ordinary. Typed work — an automation fire, a
            // task assignment, an action attention — is keyed by its own
            // identity, reaches the Agent nowhere else, and survives a mute.
            sql`exists (
                    select 1 from ${chatMessagesTable} message
                    where message.server_id = ${agentInboxTable.serverId}
                      and message.id = ${agentInboxTable.dedupeKey}
                )`,
            sql`not exists (
                    select 1 from ${messageTasksTable} task
                    where task.server_id = ${agentInboxTable.serverId}
                      and task.message_id = ${agentInboxTable.dedupeKey}
                      and task.assignee_agent_id = ${agentInboxTable.agentId}
                )`
        )
    );
}

export async function beginActiveRun(
    db: GrottoDatabase,
    input: {
        agentId: string;
        chatId: string;
        computerId: string;
        modelId: string;
        reasoningEffort: AgentReasoningEffort;
        runId: string;
        runtimeId: string;
    }
): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({
            acceptedAt: null,
            activeRunChatId: input.chatId,
            activeRunComputerId: input.computerId,
            activeRunId: input.runId,
            activeRunModelId: input.modelId,
            activeRunReasoningEffort: input.reasoningEffort,
            activeRunRuntimeId: input.runtimeId,
            dispatchedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(agentDeliveryTable.agentId, input.agentId));
}

/** Records the Computer's local-acceptance ack. Idempotent and match-guarded. */
export async function markAccepted(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(
            and(
                eq(agentDeliveryTable.agentId, input.agentId),
                eq(agentDeliveryTable.activeRunId, input.runId),
                isNull(agentDeliveryTable.acceptedAt)
            )
        );
    await markInboxItemsAccepted(db, input);
    await markConcreteItemsServed(db, input);
}

export async function markDispatched(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({ dispatchedAt: new Date(), updatedAt: new Date() })
        .where(
            and(
                eq(agentDeliveryTable.agentId, input.agentId),
                eq(agentDeliveryTable.activeRunId, input.runId)
            )
        );
}

export async function clearActiveRun(db: GrottoDatabase, agentId: string): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({
            acceptedAt: null,
            activeRunChatId: null,
            activeRunComputerId: null,
            activeRunId: null,
            activeRunModelId: null,
            activeRunReasoningEffort: null,
            activeRunRuntimeId: null,
            dispatchedAt: null,
            updatedAt: new Date(),
        })
        .where(eq(agentDeliveryTable.agentId, agentId));
}

/** Records a run failure: bumps the failure count and sets the next retry (or degraded). */
export async function recordDeliveryFailure(
    db: GrottoDatabase,
    input: { agentId: string; consecutiveFailures: number; retryAfter: Date | null }
): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({
            consecutiveFailures: input.consecutiveFailures,
            retryAfter: input.retryAfter,
            updatedAt: new Date(),
        })
        .where(eq(agentDeliveryTable.agentId, input.agentId));
}

/** Clears the failure backoff — a success or fresh human intent re-enables dispatch. */
export async function clearDeliveryFailures(db: GrottoDatabase, agentId: string): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({ consecutiveFailures: 0, retryAfter: null, updatedAt: new Date() })
        .where(eq(agentDeliveryTable.agentId, agentId));
}

export async function setAgentChainTurns(
    db: GrottoDatabase,
    input: { agentId: string; turns: number }
): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({ agentChainTurns: input.turns, updatedAt: new Date() })
        .where(eq(agentDeliveryTable.agentId, input.agentId));
}

/**
 * Consumes a settled run's claimed work. The rows leave the live queue for
 * good, but stay readable as the turn's delivery evidence: a turn that read a
 * message and answered nothing is only provable from a retained `seen` row.
 */
export async function markInboxItemsSeenForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentInboxTable)
        .set({
            servedAt: sql`coalesce(${agentInboxTable.servedAt}, ${new Date()})`,
            seenAt: new Date(),
            settledRunId: input.runId,
            state: 'seen',
        })
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                eq(agentInboxTable.runId, input.runId),
                ne(agentInboxTable.state, 'seen')
            )
        );
}

/** Returns a failed or stopped run's claimed work to the queue so it is redelivered. */
export async function requeueInboxItemsForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentInboxTable)
        .set({ acceptedAt: null, runId: null, servedAt: null, state: 'queued' })
        .where(
            and(
                eq(agentInboxTable.agentId, input.agentId),
                eq(agentInboxTable.runId, input.runId),
                ne(agentInboxTable.state, 'seen')
            )
        );
}

/** Agents assigned to one Computer, for reconnect reconciliation. */
export async function listComputerAgents(
    db: GrottoDatabase,
    computerId: string
): Promise<
    {
        agentDescription: string | null;
        agentId: string;
        agentName: string;
        desiredModelId: string | null;
        desiredReasoningEffort: AgentReasoningEffort;
        desiredRuntimeId: string | null;
        factoryAppliedAt: Date | null;
        factoryKind: 'cove' | 'ordinary';
        retiredAt: Date | null;
        sessionGeneration: number;
        sessionResetKind: 'full' | 'session';
        serverId: string;
    }[]
> {
    const rows = await db
        .select({
            agentDescription: agentsTable.description,
            agentId: agentsTable.id,
            agentName: agentsTable.displayName,
            desiredModelId: agentsTable.desiredModelId,
            desiredReasoningEffort: agentsTable.desiredReasoningEffort,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            factoryAppliedAt: agentsTable.factoryAppliedAt,
            factoryKind: agentsTable.factoryKind,
            retiredAt: agentsTable.retiredAt,
            sessionGeneration: agentsTable.sessionGeneration,
            sessionResetKind: agentsTable.sessionResetKind,
            serverId: agentsTable.serverId,
        })
        .from(agentsTable)
        .where(eq(agentsTable.computerId, computerId));
    return rows;
}

/**
 * Every Agent the retry sweep should re-examine: one with an unacknowledged
 * in-flight run, or one with queued work and no active run that is not stopped,
 * not inside its failure backoff, and not degraded (`maxFailures` reached).
 */
export async function listDispatchCandidates(
    db: GrottoDatabase,
    maxFailures: number
): Promise<{ agentId: string; serverId: string }[]> {
    const now = new Date();
    const unacknowledged = await db
        .select({ agentId: agentDeliveryTable.agentId, serverId: agentDeliveryTable.serverId })
        .from(agentDeliveryTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, agentDeliveryTable.serverId),
                eq(agentsTable.id, agentDeliveryTable.agentId)
            )
        )
        .where(
            and(
                isNotNull(agentDeliveryTable.activeRunId),
                isNull(agentDeliveryTable.acceptedAt),
                isNull(agentsTable.retiredAt)
            )
        );
    const queued = await db
        .selectDistinct({
            agentId: agentDeliveryTable.agentId,
            serverId: agentDeliveryTable.serverId,
        })
        .from(agentInboxTable)
        .innerJoin(agentDeliveryTable, eq(agentDeliveryTable.agentId, agentInboxTable.agentId))
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, agentDeliveryTable.serverId),
                eq(agentsTable.id, agentDeliveryTable.agentId)
            )
        )
        .where(
            and(
                isNull(agentInboxTable.runId),
                eq(agentInboxTable.state, 'queued'),
                isNull(agentDeliveryTable.activeRunId),
                eq(agentDeliveryTable.stopped, false),
                isNull(agentsTable.retiredAt),
                lt(agentDeliveryTable.consecutiveFailures, maxFailures),
                or(isNull(agentDeliveryTable.retryAfter), lte(agentDeliveryTable.retryAfter, now))
            )
        );

    const unmaterializedActions = await db
        .selectDistinct({
            agentId: agentActionAttentionsTable.agentId,
            serverId: agentActionAttentionsTable.serverId,
            activeRunId: agentDeliveryTable.activeRunId,
            stopped: agentDeliveryTable.stopped,
            consecutiveFailures: agentDeliveryTable.consecutiveFailures,
            retryAfter: agentDeliveryTable.retryAfter,
        })
        .from(agentActionAttentionsTable)
        .leftJoin(
            agentDeliveryTable,
            and(
                eq(agentDeliveryTable.serverId, agentActionAttentionsTable.serverId),
                eq(agentDeliveryTable.agentId, agentActionAttentionsTable.agentId)
            )
        )
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, agentActionAttentionsTable.serverId),
                eq(agentsTable.id, agentActionAttentionsTable.agentId)
            )
        )
        .where(
            and(
                isNull(agentsTable.retiredAt),
                sql`not exists (
                    select 1 from ${agentInboxTable} item
                    where item.server_id = ${agentActionAttentionsTable.serverId}
                      and item.agent_id = ${agentActionAttentionsTable.agentId}
                      and item.dedupe_key = ${agentActionAttentionsTable.actionId}
                )`
            )
        );

    const byAgent = new Map<string, { agentId: string; serverId: string }>();
    for (const row of [...unacknowledged, ...queued]) {
        byAgent.set(row.agentId, row);
    }
    for (const row of unmaterializedActions) {
        if (
            row.activeRunId === null &&
            row.stopped !== true &&
            (row.consecutiveFailures ?? 0) < maxFailures &&
            (row.retryAfter === null || row.retryAfter === undefined || row.retryAfter <= now)
        ) {
            byAgent.set(row.agentId, { agentId: row.agentId, serverId: row.serverId });
        }
    }
    return [...byAgent.values()];
}

/**
 * Inbox items normally share a database timestamp when one Chat operation
 * enqueues several messages. Use the canonical Chat sequence as the stable
 * tie-breaker so a task arrives before its assignment handoff in the Agent
 * prompt and message-check drain; typed work with no Chat message sorts last.
 */
function inboxOrder() {
    return [
        agentInboxTable.createdAt,
        sql`coalesce((
            select message.sequence
            from ${chatMessagesTable} message
            where message.server_id = ${agentInboxTable.serverId}
              and message.id = ${agentInboxTable.dedupeKey}
        ), 2147483647)`,
        agentInboxTable.id,
    ] as const;
}

/** The live queue predicate: the only rows a dispatch may still deliver. */
function queuedFor(agentId: string) {
    return and(
        eq(agentInboxTable.agentId, agentId),
        eq(agentInboxTable.state, 'queued'),
        isNull(agentInboxTable.runId)
    );
}
