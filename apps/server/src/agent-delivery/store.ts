import { and, eq, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentDeliveryTable, agentPendingWorkTable, agentsTable } from '../postgres/schema.ts';

export interface AgentDeliveryRow {
    acceptedAt: Date | null;
    activeRunChatId: string | null;
    activeRunComputerId: string | null;
    activeRunId: string | null;
    activeRunModelId: string | null;
    activeRunRuntimeId: string | null;
    agentChainTurns: number;
    agentId: string;
    consecutiveFailures: number;
    retryAfter: Date | null;
    serverId: string;
    stopped: boolean;
}

export interface PendingWorkRow {
    chatId: string;
    content: string;
    createdAt: Date;
    dedupeKey: string;
    id: string;
    noticeRunId: string | null;
    pierced: boolean;
    serverId: string;
    source: string;
}

export interface AgentDispatchConfig {
    agentDescription: string | null;
    agentDisplayName: string;
    agentName: string;
    computerId: string | null;
    desiredModelId: string | null;
    desiredRuntimeId: string | null;
    factoryAppliedAt: Date | null;
    factoryKind: 'cove' | 'ordinary';
    homeTimezone: string;
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
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            factoryAppliedAt: agentsTable.factoryAppliedAt,
            factoryKind: agentsTable.factoryKind,
            homeTimezone: agentsTable.homeTimezone,
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
 * Records one unit of pending work, ignoring a duplicate delivery of the same
 * message: the `(server, agent, dedupeKey)` uniqueness makes a re-emitted wake
 * a no-op instead of a second inbox row.
 */
export async function enqueuePendingWork(
    db: GrottoDatabase,
    input: {
        agentId: string;
        chatId: string;
        content: string;
        dedupeKey: string;
        pierced?: boolean;
        serverId: string;
        source: string;
    }
): Promise<void> {
    await db
        .insert(agentPendingWorkTable)
        .values({
            agentId: input.agentId,
            chatId: input.chatId,
            content: input.content,
            dedupeKey: input.dedupeKey,
            id: createOpaqueId('apw'),
            pierced: input.pierced ?? false,
            serverId: input.serverId,
            source: input.source,
        })
        .onConflictDoNothing();
}

export async function countQueuedPending(db: GrottoDatabase, agentId: string): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agentPendingWorkTable)
        .where(queuedFor(agentId));
    return row?.total ?? 0;
}

export async function countQueuedMessagePending(
    db: GrottoDatabase,
    agentId: string
): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agentPendingWorkTable)
        .where(and(queuedFor(agentId), ne(agentPendingWorkTable.source, 'onboarding')));
    return row?.total ?? 0;
}

/**
 * Associates an explicit in-turn pull with the accepted run that received it.
 * Settlement can then advance `seen` for the pulled rows, while an unsettled
 * run keeps them durable and replayable under the same run id.
 */
export async function attachQueuedPendingToRun(
    db: GrottoDatabase,
    input: { agentId: string; pendingIds: string[]; runId: string }
): Promise<void> {
    if (input.pendingIds.length === 0) {
        return;
    }
    await db
        .update(agentPendingWorkTable)
        .set({ runId: input.runId, state: 'accepted' })
        .where(and(queuedFor(input.agentId), inArray(agentPendingWorkTable.id, input.pendingIds)));
}

/** Records the Computer ack for every row already attached to the acknowledged run. */
async function markPendingAccepted(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentPendingWorkTable)
        .set({ acceptedAt: new Date() })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId),
                isNull(agentPendingWorkTable.acceptedAt)
            )
        );
}

/**
 * Records that exact attached rows were handed to the model during the run. A
 * pull only reaches an accepted run, so a row attached after the ack takes its
 * acceptance stamp here rather than losing it.
 */
export async function markPendingServed(
    db: GrottoDatabase,
    input: { agentId: string; pendingIds: string[]; runId: string }
): Promise<void> {
    if (input.pendingIds.length === 0) {
        return;
    }
    const now = new Date();
    await db
        .update(agentPendingWorkTable)
        .set({
            acceptedAt: sql`coalesce(${agentPendingWorkTable.acceptedAt}, ${now})`,
            servedAt: now,
            state: 'served',
        })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId),
                ne(agentPendingWorkTable.state, 'seen'),
                inArray(agentPendingWorkTable.id, input.pendingIds)
            )
        );
}

export async function listPendingForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<PendingWorkRow[]> {
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId),
                ne(agentPendingWorkTable.state, 'seen')
            )
        )
        .orderBy(agentPendingWorkTable.createdAt);
}

export async function listQueuedPending(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<PendingWorkRow[]> {
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(queuedFor(agentId))
        .orderBy(agentPendingWorkTable.createdAt)
        .limit(limit);
}

export async function listPendingNoticedForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<PendingWorkRow[]> {
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(
            and(queuedFor(input.agentId), eq(agentPendingWorkTable.startNoticeRunId, input.runId))
        )
        .orderBy(agentPendingWorkTable.createdAt);
}

export async function listPendingOfferedForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<PendingWorkRow[]> {
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(and(queuedFor(input.agentId), eq(agentPendingWorkTable.noticeRunId, input.runId)))
        .orderBy(agentPendingWorkTable.createdAt);
}

export async function listPendingByDedupeKeys(
    db: GrottoDatabase,
    input: { agentId: string; dedupeKeys: string[]; runId: string }
): Promise<PendingWorkRow[]> {
    if (input.dedupeKeys.length === 0) {
        return [];
    }
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                inArray(agentPendingWorkTable.dedupeKey, input.dedupeKeys),
                or(
                    and(
                        isNull(agentPendingWorkTable.runId),
                        eq(agentPendingWorkTable.state, 'queued')
                    ),
                    eq(agentPendingWorkTable.runId, input.runId)
                )
            )
        );
}

/** Ordinary Chat rows queryable through the Agent message surfaces. */
export async function listQueuedMessagePending(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<PendingWorkRow[]> {
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(and(queuedFor(agentId), ne(agentPendingWorkTable.source, 'onboarding')))
        .orderBy(agentPendingWorkTable.createdAt)
        .limit(limit);
}

/** Marks exact queued identities as offered to the current turn, without making bodies visible. */
export async function markPendingNoticed(
    db: GrottoDatabase,
    input: { agentId: string; initial?: boolean; pendingIds: string[]; runId: string }
): Promise<void> {
    if (input.pendingIds.length === 0) {
        return;
    }
    await db
        .update(agentPendingWorkTable)
        .set({
            noticeRunId: input.runId,
            ...(input.initial ? { startNoticeRunId: input.runId } : {}),
        })
        .where(and(queuedFor(input.agentId), inArray(agentPendingWorkTable.id, input.pendingIds)));
}

export async function clearPendingNotices(
    db: GrottoDatabase,
    input: { agentId: string; runId?: string }
): Promise<void> {
    await db
        .update(agentPendingWorkTable)
        .set({ noticeRunId: null, startNoticeRunId: null })
        .where(
            and(
                queuedFor(input.agentId),
                input.runId ? eq(agentPendingWorkTable.noticeRunId, input.runId) : undefined
            )
        );
}

export async function listUnnoticedQueuedPending(
    db: GrottoDatabase,
    agentId: string,
    limit: number
): Promise<PendingWorkRow[]> {
    return await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            noticeRunId: agentPendingWorkTable.noticeRunId,
            pierced: agentPendingWorkTable.pierced,
            serverId: agentPendingWorkTable.serverId,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(and(queuedFor(agentId), isNull(agentPendingWorkTable.noticeRunId)))
        .orderBy(agentPendingWorkTable.createdAt)
        .limit(limit);
}

export async function deleteQueuedOrdinaryWork(
    db: GrottoDatabase,
    input: { agentId: string; chatIds: string[]; serverId: string }
): Promise<void> {
    if (input.chatIds.length === 0) {
        return;
    }
    await db
        .delete(agentPendingWorkTable)
        .where(
            and(
                queuedFor(input.agentId),
                eq(agentPendingWorkTable.serverId, input.serverId),
                inArray(agentPendingWorkTable.chatId, input.chatIds),
                eq(agentPendingWorkTable.pierced, false)
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
    await markPendingAccepted(db, input);
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
export async function markPendingSeenForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentPendingWorkTable)
        .set({ seenAt: new Date(), settledRunId: input.runId, state: 'seen' })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId),
                ne(agentPendingWorkTable.state, 'seen')
            )
        );
}

/** Returns a failed or stopped run's claimed work to the queue so it is redelivered. */
export async function requeuePendingForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .update(agentPendingWorkTable)
        .set({ acceptedAt: null, runId: null, servedAt: null, state: 'queued' })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId),
                ne(agentPendingWorkTable.state, 'seen')
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
        .where(
            and(isNotNull(agentDeliveryTable.activeRunId), isNull(agentDeliveryTable.acceptedAt))
        );
    const queued = await db
        .selectDistinct({
            agentId: agentDeliveryTable.agentId,
            serverId: agentDeliveryTable.serverId,
        })
        .from(agentPendingWorkTable)
        .innerJoin(
            agentDeliveryTable,
            eq(agentDeliveryTable.agentId, agentPendingWorkTable.agentId)
        )
        .where(
            and(
                isNull(agentPendingWorkTable.runId),
                eq(agentPendingWorkTable.state, 'queued'),
                isNull(agentDeliveryTable.activeRunId),
                eq(agentDeliveryTable.stopped, false),
                lt(agentDeliveryTable.consecutiveFailures, maxFailures),
                or(isNull(agentDeliveryTable.retryAfter), lte(agentDeliveryTable.retryAfter, now))
            )
        );

    const byAgent = new Map<string, { agentId: string; serverId: string }>();
    for (const row of [...unacknowledged, ...queued]) {
        byAgent.set(row.agentId, row);
    }
    return [...byAgent.values()];
}

/** The live queue predicate: the only rows a dispatch may still deliver. */
function queuedFor(agentId: string) {
    return and(
        eq(agentPendingWorkTable.agentId, agentId),
        eq(agentPendingWorkTable.state, 'queued'),
        isNull(agentPendingWorkTable.runId)
    );
}
