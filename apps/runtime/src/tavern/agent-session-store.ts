import {
    type AgentRuntimeAgentSession,
    type AgentRuntimeModelName,
    agentRuntimeAgentSessionSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { resolveAgentModelSelection } from '../models/selection-service';

// One global session per agent spanning all its chats (specs/sessions.md,
// ADR 0011). Chats are routing surfaces; per-chat seen cursors live in the
// seen ledger (seen-ledger.ts). Sessions never rotate on age or idleness —
// only on a runtime/model switch, a manual reset (agent-session-reset.ts), or
// automatic resume recovery (agent-turn-runner.ts).

interface AgentSessionRow {
    agent_id: string;
    archived_at: null | string;
    created_at: string;
    effective_model_json: string;
    generation: number;
    id: string;
    instructions_hash: null | string;
    last_turn_at: null | string;
    resume_state_json: null | string;
    runtime_session_id: null | string;
    status: AgentRuntimeAgentSession['status'];
    updated_at: string;
}

/**
 * The agent's current global session, created on first use. A stored model
 * change rotates lazily here: the session's effective model is fixed at
 * creation, so a mismatch with the agent's selected model starts a fresh
 * session (Raft semantics — model switches take effect on the next turn).
 */
export function ensureCurrentAgentSession(input: {
    agentId: string;
    db?: Database;
    now?: string;
}): AgentRuntimeAgentSession {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date().toISOString();
    const current = readCurrentAgentSession({ agentId: input.agentId, db });
    if (!current) {
        return startNewAgentSession({ agentId: input.agentId, db, now });
    }

    const selectedModel = resolveAgentModelSelection({ agentId: input.agentId, db });
    if (!sameModel(current.effectiveModel, selectedModel)) {
        return startNewAgentSession({
            agentId: input.agentId,
            db,
            effectiveModel: selectedModel,
            now,
        });
    }
    return current;
}

export function startNewAgentSession(input: {
    agentId: string;
    db?: Database;
    effectiveModel?: AgentRuntimeModelName;
    now?: string;
    resumeState?: Record<string, unknown> | null;
    runtimeSessionId?: string | null;
}): AgentRuntimeAgentSession {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date().toISOString();
    const generation = nextGeneration(input.agentId, db);
    const id = createAgentSessionId(input.agentId, generation);
    const effectiveModel =
        input.effectiveModel ?? resolveAgentModelSelection({ agentId: input.agentId, db });

    const transaction = db.transaction(() => {
        db.prepare(
            `UPDATE agent_sessions
             SET status = 'archived',
                 archived_at = COALESCE(archived_at, $now),
                 updated_at = $now
             WHERE agent_id = $agentId AND status = 'active'`
        ).run(namedParams({ agentId: input.agentId, now }));

        db.prepare(
            `INSERT INTO agent_sessions (
                id, agent_id, generation, effective_model_json,
                runtime_session_id, resume_state_json, instructions_hash,
                status, created_at, updated_at, archived_at, last_turn_at
             )
             VALUES (
                $id, $agentId, $generation, $effectiveModelJson,
                $runtimeSessionId, $resumeStateJson, NULL,
                'active', $now, $now, NULL, NULL
             )`
        ).run(
            namedParams({
                agentId: input.agentId,
                effectiveModelJson: JSON.stringify(effectiveModel),
                generation,
                id,
                now,
                resumeStateJson:
                    input.resumeState === undefined || input.resumeState === null
                        ? null
                        : JSON.stringify(input.resumeState),
                runtimeSessionId: input.runtimeSessionId ?? null,
            })
        );
    });
    transaction();

    const session = readAgentSession(id, db);
    if (!session) {
        throw new Error(`Agent session ${id} was not persisted.`);
    }
    return session;
}

export function readCurrentAgentSession(input: {
    agentId: string;
    db?: Database;
}): AgentRuntimeAgentSession | null {
    const db = input.db ?? getDb();
    const row = db
        .prepare(
            `SELECT *
             FROM agent_sessions
             WHERE agent_id = $agentId AND status = 'active'
             ORDER BY generation DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId: input.agentId })) as AgentSessionRow | null;
    return row ? rowToAgentSession(row) : null;
}

export function listAgentSessionsForAgent(agentId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT *
             FROM agent_sessions
             WHERE agent_id = $agentId
             ORDER BY generation ASC`
        )
        .all(namedParams({ agentId })) as AgentSessionRow[];
    return rows.map(rowToAgentSession);
}

/**
 * Records the fingerprint of the instructions actually delivered to the
 * engine session. Written on non-resume turns only — harness adapters drop
 * instructions on resumed turns, so the delivered set is fixed at session
 * start.
 */
export function recordAgentSessionInstructionsHash(input: {
    db?: Database;
    hash: string;
    id: string;
    now?: string;
}) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_sessions
         SET instructions_hash = $hash,
             updated_at = $now
         WHERE id = $id`
    ).run(namedParams({ hash: input.hash, id: input.id, now }));
}

export function readAgentSessionInstructionsHash(id: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT instructions_hash FROM agent_sessions WHERE id = $id LIMIT 1')
        .get(namedParams({ id })) as { instructions_hash: null | string } | null;
    return row?.instructions_hash ?? null;
}

export function updateAgentSessionRuntimeState(input: {
    db?: Database;
    id: string;
    now?: string;
    resumeState?: Record<string, unknown> | null;
    runtimeSessionId?: string | null;
}) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date().toISOString();
    db.prepare(
        `UPDATE agent_sessions
         SET runtime_session_id = $runtimeSessionId,
             resume_state_json = $resumeStateJson,
             last_turn_at = $now,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            id: input.id,
            now,
            resumeStateJson:
                input.resumeState === undefined || input.resumeState === null
                    ? null
                    : JSON.stringify(input.resumeState),
            runtimeSessionId: input.runtimeSessionId ?? null,
        })
    );

    return readAgentSession(input.id, db);
}

export function readAgentSession(
    id: string,
    db: Database = getDb()
): AgentRuntimeAgentSession | null {
    const row = db
        .prepare('SELECT * FROM agent_sessions WHERE id = $id LIMIT 1')
        .get(namedParams({ id })) as AgentSessionRow | null;
    return row ? rowToAgentSession(row) : null;
}

function nextGeneration(agentId: string, db: Database) {
    const row = db
        .prepare(
            `SELECT MAX(generation) AS generation
             FROM agent_sessions
             WHERE agent_id = $agentId`
        )
        .get(namedParams({ agentId })) as { generation: null | number };
    return (row.generation ?? 0) + 1;
}

function sameModel(a: AgentRuntimeModelName, b: AgentRuntimeModelName) {
    return a.provider === b.provider && a.model === b.model;
}

function rowToAgentSession(row: AgentSessionRow): AgentRuntimeAgentSession {
    return agentRuntimeAgentSessionSchema.parse({
        agentId: row.agent_id,
        archivedAt: row.archived_at,
        createdAt: row.created_at,
        effectiveModel: JSON.parse(row.effective_model_json) as unknown,
        generation: row.generation,
        id: row.id,
        lastTurnAt: row.last_turn_at,
        resumeState: row.resume_state_json
            ? (JSON.parse(row.resume_state_json) as Record<string, unknown>)
            : null,
        runtimeSessionId: row.runtime_session_id,
        status: row.status,
        updatedAt: row.updated_at,
    });
}

function createAgentSessionId(agentId: string, generation: number) {
    return `ags_${agentId.replace(/[^A-Za-z0-9_-]/g, '_')}_${generation}`;
}
