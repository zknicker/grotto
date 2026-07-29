import type { AgentArchetypeId } from '@tavern/api';
import { and, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentDeliveryTable, agentPendingWorkTable, agentsTable } from '../postgres/schema.ts';

export interface AgentDeliveryRow {
    acceptedAt: Date | null;
    activeRunChatId: string | null;
    activeRunComputerId: string | null;
    activeRunId: string | null;
    activeRunModelId: string | null;
    activeRunPrompt: string | null;
    activeRunRuntimeId: string | null;
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
    source: string;
}

export interface AgentDispatchConfig {
    agentDescription: string | null;
    agentName: string;
    computerId: string | null;
    desiredModelId: string | null;
    desiredRuntimeId: string | null;
    homeTimezone: string;
}

/** The Agent's assigned Computer and desired runtime/model, or nulls when unconfigured. */
export async function readAgentDispatchConfig(
    db: GrottoDatabase,
    agentId: string
): Promise<AgentDispatchConfig | null> {
    const [row] = await db
        .select({
            agentDescription: agentsTable.description,
            agentName: agentsTable.handle,
            computerId: agentsTable.computerId,
            desiredModelId: agentsTable.desiredModelId,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            homeTimezone: agentsTable.homeTimezone,
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
 * Claims the Agent's next bounded inbox drain across every target. The oldest
 * queued rows are claimed up to `maxRows` and `maxChars` (always at least one),
 * preserving the floating-session contract instead of hiding work behind one
 * launch chat.
 */
export async function claimQueuedPendingForNextChat(
    db: GrottoDatabase,
    input: { agentId: string; maxChars: number; maxRows: number; runId: string }
): Promise<PendingWorkRow[]> {
    const candidates = await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            content: agentPendingWorkTable.content,
            createdAt: agentPendingWorkTable.createdAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            id: agentPendingWorkTable.id,
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                isNull(agentPendingWorkTable.runId)
            )
        )
        .orderBy(agentPendingWorkTable.createdAt);

    const chosen: PendingWorkRow[] = [];
    let chars = 0;
    for (const row of candidates) {
        const nextChars = chars + row.content.length;
        if (chosen.length > 0 && (chosen.length >= input.maxRows || nextChars > input.maxChars)) {
            break;
        }
        chosen.push(row);
        chars = nextChars;
    }
    await db
        .update(agentPendingWorkTable)
        .set({ runId: input.runId })
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                inArray(
                    agentPendingWorkTable.id,
                    chosen.map((row) => row.id)
                )
            )
        );
    return chosen;
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
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId)
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
            source: agentPendingWorkTable.source,
        })
        .from(agentPendingWorkTable)
        .where(and(eq(agentPendingWorkTable.agentId, agentId), isNull(agentPendingWorkTable.runId)))
        .orderBy(agentPendingWorkTable.createdAt)
        .limit(limit);
}

export async function beginActiveRun(
    db: GrottoDatabase,
    input: {
        agentId: string;
        chatId: string;
        computerId: string;
        modelId: string;
        prompt: string;
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
            activeRunPrompt: input.prompt,
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
            activeRunPrompt: null,
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
): Promise<
    {
        agentDescription: string | null;
        agentId: string;
        agentName: string;
        archetype: AgentArchetypeId | null;
        desiredModelId: string | null;
        desiredRuntimeId: string | null;
        serverId: string;
    }[]
> {
    const rows = await db
        .select({
            agentDescription: agentsTable.description,
            agentId: agentsTable.id,
            agentName: agentsTable.displayName,
            archetype: agentsTable.archetype,
            desiredModelId: agentsTable.desiredModelId,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
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
