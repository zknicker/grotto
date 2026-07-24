import {
    type AgentRuntimeAgent,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentSchema,
} from '@tavern/api';
import { removeAgentToolEnvironment } from '../agent-engine/agent-cli-wrapper.ts';
import { ensureDefaultHostToolGrants } from '../agent-engine/host-tools.ts';
import { closeMcpClientsForAgent } from '../agent-engine/mcp-clients.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { archiveAgentDmChat, ensureAgentDmChat } from './bootstrap-chats.ts';
import { assertParticipantHandleAvailable, assertParticipantSeatAvailable } from './handles.ts';

interface AgentRow {
    created_at: string;
    enabled_skill_ids_json: string;
    id: string;
    is_admin: 0 | 1;
    last_synced_at: string;
    name: string;
    primary_color: string | null;
    raw_json: string;
    updated_at: string;
    workspace_folder: string;
}

export function listStoredAgents(db: Database = getDb()) {
    const rows = db.prepare('SELECT * FROM agents ORDER BY name ASC, id ASC').all() as AgentRow[];

    return agentRuntimeAgentListSchema.parse({
        agents: rows.map((row) => rowToAgent(row, db)),
    });
}

export function getStoredAgent(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT * FROM agents WHERE id = $id LIMIT 1')
        .get(namedParams({ id: agentId })) as AgentRow | null;

    return row ? rowToAgent(row, db) : null;
}

export function upsertStoredAgent(input: {
    agent: AgentRuntimeAgent;
    db?: Database;
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const existing = getStoredAgent(input.agent.id, db);
    const agent = agentRuntimeAgentSchema.parse({
        ...input.agent,
        bio: input.agent.bio === undefined ? (existing?.bio ?? undefined) : input.agent.bio,
        // null clears the override; only undefined preserves the stored value.
        thinkingDefault:
            input.agent.thinkingDefault === undefined
                ? (existing?.thinkingDefault ?? undefined)
                : input.agent.thinkingDefault,
    });

    writeStoredAgent({
        agent,
        createdAt: existing ? undefined : syncedAt,
        db,
        syncedAt,
    });
    ensureAgentDmChat({ agentId: agent.id, agentName: agent.name, db });
    if (!existing) {
        ensureDefaultHostToolGrants(agent.id, db);
    }

    const saved = getStoredAgent(agent.id, db);
    if (!saved) {
        throw new Error(`Agent "${agent.id}" was not persisted.`);
    }
    return saved;
}

export function deleteStoredAgent(agentId: string, db: Database = getDb()) {
    void closeMcpClientsForAgent(agentId);
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('DELETE FROM agents WHERE id = $id').run(namedParams({ id: agentId }));
        archiveAgentDmChat({ agentId, db });
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    removeAgentToolEnvironment(agentId);
}

export function updateStoredAgent(input: {
    agentId: string;
    webAccessEnabled?: boolean;
    bio?: string | null;
    db?: Database;
    enabledSkillIds?: string[];
    name?: string;
    thinkingDefault?: AgentRuntimeAgent['thinkingDefault'];
}) {
    const db = input.db ?? getDb();
    const existing = getStoredAgent(input.agentId, db);
    if (!existing) {
        return null;
    }

    return upsertStoredAgent({
        agent: {
            ...existing,
            ...(input.webAccessEnabled === undefined
                ? {}
                : { webAccessEnabled: input.webAccessEnabled }),
            ...(input.bio === undefined ? {} : { bio: input.bio }),
            ...(input.enabledSkillIds === undefined
                ? {}
                : { enabledSkillIds: input.enabledSkillIds }),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.thinkingDefault === undefined
                ? {}
                : { thinkingDefault: input.thinkingDefault }),
        },
        db,
    });
}

export function replaceStoredAgents(input: {
    agents: AgentRuntimeAgent[];
    syncedAt?: string;
    db?: Database;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const existing = listStoredAgents(db).agents;
    const existingJsonById = new Map(existing.map((agent) => [agent.id, stableAgentJson(agent)]));
    const nextJsonById = new Map(input.agents.map((agent) => [agent.id, stableAgentJson(agent)]));
    const changedAgentIds = new Set<string>();

    for (const agent of input.agents) {
        if (existingJsonById.get(agent.id) !== nextJsonById.get(agent.id)) {
            changedAgentIds.add(agent.id);
        }
    }

    for (const agent of existing) {
        if (!nextJsonById.has(agent.id)) {
            changedAgentIds.add(agent.id);
            void closeMcpClientsForAgent(agent.id);
        }
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const agent of input.agents) {
            writeStoredAgent({ agent, createdAt: syncedAt, db, syncedAt });
        }

        const nextIds = input.agents.map((agent) => agent.id);
        if (nextIds.length === 0) {
            db.prepare('DELETE FROM agents').run();
        } else {
            const placeholders = nextIds.map(() => '?').join(', ');
            db.prepare(`DELETE FROM agents WHERE id NOT IN (${placeholders})`).run(...nextIds);
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    for (const agent of existing) {
        if (!nextJsonById.has(agent.id)) {
            removeAgentToolEnvironment(agent.id);
        }
    }
    for (const agent of input.agents) {
        ensureAgentDmChat({ agentId: agent.id, agentName: agent.name, db });
        if (!existingJsonById.has(agent.id)) {
            ensureDefaultHostToolGrants(agent.id, db);
        }
    }

    return {
        changedAgentIds: [...changedAgentIds].sort(),
        synced: input.agents.length,
    };
}

function rowToAgent(row: AgentRow, db: Database): AgentRuntimeAgent {
    const raw = parseRawAgent(row.raw_json);

    return agentRuntimeAgentSchema.parse({
        webAccessEnabled: raw?.webAccessEnabled ?? false,
        ...(raw?.bio == null ? {} : { bio: raw.bio }),
        enabledSkillIds: listAssignedSkillIds(row.id, db),
        id: row.id,
        isAdmin: row.is_admin === 1,
        name: row.name,
        primaryColor: row.primary_color,
        ...(raw?.thinkingDefault === undefined ? {} : { thinkingDefault: raw.thinkingDefault }),
        workspaceFolder: row.workspace_folder,
    });
}

function listAssignedSkillIds(agentId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT skill_id
             FROM agent_skill_assignments
             WHERE agent_id = $agentId AND enabled = 1
             ORDER BY created_at ASC, skill_id ASC`
        )
        .all(namedParams({ agentId })) as Array<{ skill_id: string }>;

    return rows.map((row) => row.skill_id);
}

function stableAgentJson(agent: AgentRuntimeAgent) {
    return JSON.stringify({
        webAccessEnabled: agent.webAccessEnabled ?? false,
        ...(agent.bio == null ? {} : { bio: agent.bio }),
        enabledSkillIds: agent.enabledSkillIds,
        id: agent.id,
        isAdmin: agent.isAdmin,
        name: agent.name,
        primaryColor: agent.primaryColor,
        ...(agent.thinkingDefault === undefined ? {} : { thinkingDefault: agent.thinkingDefault }),
        workspaceFolder: agent.workspaceFolder,
    });
}

function parseRawAgent(value: string) {
    try {
        const parsed = JSON.parse(value) as unknown;
        const result = agentRuntimeAgentSchema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}

function writeStoredAgent(input: {
    agent: AgentRuntimeAgent;
    createdAt?: string;
    db: Database;
    syncedAt: string;
}) {
    assertParticipantHandleAvailable(input.agent.name, input.agent.id, input.db);
    assertParticipantSeatAvailable(input.agent.id, input.db);
    const enabledSkillIds = [...new Set(input.agent.enabledSkillIds)];

    input.db
        .prepare(
            `INSERT INTO agents (
                id,
                name,
                primary_color,
                workspace_folder,
                enabled_skill_ids_json,
                is_admin,
                raw_json,
                last_synced_at,
                created_at,
                updated_at
            )
            VALUES (
                $id,
                $name,
                $primaryColor,
                $workspaceFolder,
                $enabledSkillIdsJson,
                $isAdmin,
                $rawJson,
                $lastSyncedAt,
                $createdAt,
                $updatedAt
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                primary_color = excluded.primary_color,
                workspace_folder = excluded.workspace_folder,
                enabled_skill_ids_json = excluded.enabled_skill_ids_json,
                is_admin = excluded.is_admin,
                raw_json = excluded.raw_json,
                last_synced_at = excluded.last_synced_at,
                updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                createdAt: input.createdAt ?? input.syncedAt,
                enabledSkillIdsJson: JSON.stringify(enabledSkillIds),
                id: input.agent.id,
                isAdmin: input.agent.isAdmin ? 1 : 0,
                lastSyncedAt: input.syncedAt,
                name: input.agent.name,
                primaryColor: input.agent.primaryColor,
                rawJson: stableAgentJson(input.agent),
                updatedAt: input.syncedAt,
                workspaceFolder: input.agent.workspaceFolder,
            })
        );

    input.db
        .prepare(
            `UPDATE chat_participants
             SET label = $name
             WHERE kind = 'agent'
               AND (id = $agentId OR json_extract(metadata_json, '$.agentId') = $agentId)`
        )
        .run(namedParams({ agentId: input.agent.id, name: input.agent.name }));

    replaceAgentSkillAssignments({
        agentId: input.agent.id,
        db: input.db,
        skillIds: enabledSkillIds,
        timestamp: input.syncedAt,
    });
}

function replaceAgentSkillAssignments(input: {
    agentId: string;
    db: Database;
    skillIds: string[];
    timestamp: string;
}) {
    input.db
        .prepare('DELETE FROM agent_skill_assignments WHERE agent_id = $agentId')
        .run(namedParams({ agentId: input.agentId }));

    const insert = input.db.prepare(
        `INSERT INTO agent_skill_assignments
         (agent_id, skill_id, enabled, created_at, updated_at)
         VALUES ($agentId, $skillId, 1, $timestamp, $timestamp)`
    );

    for (const skillId of input.skillIds) {
        insert.run(
            namedParams({
                agentId: input.agentId,
                skillId,
                timestamp: input.timestamp,
            })
        );
    }
}
