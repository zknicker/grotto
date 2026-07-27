import { and, eq, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentDeliveryTable, agentPendingWorkTable, agentsTable } from '../postgres/schema.ts';

export interface AgentDeliveryRow {
    acceptedAt: Date | null;
    activeRunChatId: string | null;
    activeRunComputerId: string | null;
    activeRunId: string | null;
    activeRunPrompt: string | null;
    agentId: string;
    consecutiveFailures: number;
    retryAfter: Date | null;
    serverId: string;
    stopped: boolean;
}

export interface PendingWorkRow {
    chatId: string;
    content: string;
    id: string;
    source: string;
}

export interface AgentDispatchConfig {
    computerId: string | null;
    desiredModelId: string | null;
    desiredRuntimeId: string | null;
}

/** The Agent's assigned Computer and desired runtime/model, or nulls when unconfigured. */
export async function readAgentDispatchConfig(
    db: GrottoDatabase,
    agentId: string
): Promise<AgentDispatchConfig | null> {
    const [row] = await db
        .select({
            computerId: agentsTable.computerId,
            desiredModelId: agentsTable.desiredModelId,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
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
            serverId: input.serverId,
            source: input.source,
        })
        .onConflictDoNothing();
}

export async function countQueuedPending(db: GrottoDatabase, agentId: string): Promise<number> {
    const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(agentPendingWorkTable)
        .where(
            and(eq(agentPendingWorkTable.agentId, agentId), isNull(agentPendingWorkTable.runId))
        );
    return row?.total ?? 0;
}

/**
 * Claims the queued work for one Agent's next chat into a run — never a mix of
 * chats. The oldest queued row picks the chat, and only that chat's queued rows
 * are claimed, so a run is bound to exactly one chat and other chats drain in
 * their own later runs. Returns the drained work, oldest first.
 */
export async function claimQueuedPendingForNextChat(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<PendingWorkRow[]> {
    const [next] = await db
        .select({ chatId: agentPendingWorkTable.chatId })
        .from(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                isNull(agentPendingWorkTable.runId)
            )
        )
        .orderBy(agentPendingWorkTable.createdAt)
        .limit(1);
    if (!next) {
        return [];
    }
    const claimed = await db
        .update(agentPendingWorkTable)
        .set({ runId: input.runId })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.chatId, next.chatId),
                isNull(agentPendingWorkTable.runId)
            )
        )
        .returning({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            id: agentPendingWorkTable.id,
            source: agentPendingWorkTable.source,
        });
    return claimed
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(({ chatId, content, id, source }) => ({ chatId, content, id, source }));
}

export async function beginActiveRun(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; computerId: string; prompt: string; runId: string }
): Promise<void> {
    await db
        .update(agentDeliveryTable)
        .set({
            acceptedAt: null,
            activeRunChatId: input.chatId,
            activeRunComputerId: input.computerId,
            activeRunId: input.runId,
            activeRunPrompt: input.prompt,
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
            activeRunPrompt: null,
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

export async function deletePendingForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string }
): Promise<void> {
    await db
        .delete(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId)
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
        .set({ runId: null })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId)
            )
        );
}

/** Agents assigned to one Computer, for reconnect reconciliation. */
export async function listComputerAgents(
    db: GrottoDatabase,
    computerId: string
): Promise<{ agentId: string; serverId: string }[]> {
    const rows = await db
        .select({ agentId: agentsTable.id, serverId: agentsTable.serverId })
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
