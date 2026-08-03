import { and, asc, eq } from 'drizzle-orm';
import { databaseClient, db } from '../db/index.ts';
import { agentProfilesTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

export interface AgentProfile {
    agentId: string;
    createdAt: string;
    primaryColor: string | null;
    runtimeId: string;
    updatedAt: string;
    userInstructions: string;
}

function selection() {
    return {
        agentId: agentProfilesTable.agentId,
        createdAt: agentProfilesTable.createdAt,
        primaryColor: agentProfilesTable.primaryColor,
        runtimeId: agentProfilesTable.runtimeId,
        updatedAt: agentProfilesTable.updatedAt,
        userInstructions: agentProfilesTable.userInstructions,
    };
}

export async function listAgentProfiles(options?: {
    includeInactive?: boolean;
    runtimeId?: string;
}) {
    const runtimeId = options?.includeInactive
        ? null
        : (options?.runtimeId ?? (await getActiveRuntimeId()));
    const query = db.select(selection()).from(agentProfilesTable);
    const scopedQuery = runtimeId
        ? query.where(eq(agentProfilesTable.runtimeId, runtimeId))
        : query;

    return await scopedQuery.orderBy(
        asc(agentProfilesTable.runtimeId),
        asc(agentProfilesTable.agentId)
    );
}

export async function getAgentProfile(input: { agentId: string; runtimeId: string }) {
    const [profile] = await db
        .select(selection())
        .from(agentProfilesTable)
        .where(
            and(
                eq(agentProfilesTable.runtimeId, input.runtimeId),
                eq(agentProfilesTable.agentId, input.agentId)
            )
        )
        .limit(1);

    return profile ?? null;
}

export async function saveAgentProfile(input: {
    agentId: string;
    primaryColor?: string | null;
    runtimeId: string;
    userInstructions?: string | null;
}) {
    const timestamp = new Date().toISOString();
    const hasPrimaryColor = Object.hasOwn(input, 'primaryColor');
    const hasUserInstructions = Object.hasOwn(input, 'userInstructions');
    const updateSet = {
        ...(hasPrimaryColor ? { primaryColor: input.primaryColor ?? null } : {}),
        ...(hasUserInstructions
            ? { userInstructions: normalizeUserInstructions(input.userInstructions) }
            : {}),
        updatedAt: timestamp,
    };

    await db
        .insert(agentProfilesTable)
        .values({
            agentId: input.agentId,
            createdAt: timestamp,
            primaryColor: hasPrimaryColor ? (input.primaryColor ?? null) : null,
            runtimeId: input.runtimeId,
            updatedAt: timestamp,
            userInstructions: hasUserInstructions
                ? normalizeUserInstructions(input.userInstructions)
                : '',
        })
        .onConflictDoUpdate({
            target: [agentProfilesTable.runtimeId, agentProfilesTable.agentId],
            set: updateSet,
        });

    return getAgentProfile(input);
}

function normalizeUserInstructions(value: string | null | undefined) {
    return (value ?? '').trim().slice(0, 20_000);
}

export async function deleteAgentProfile(input: { agentId: string; runtimeId: string }) {
    deleteAgentReferences(input.agentId);
    await db
        .delete(agentProfilesTable)
        .where(
            and(
                eq(agentProfilesTable.runtimeId, input.runtimeId),
                eq(agentProfilesTable.agentId, input.agentId)
            )
        );
}

const directAgentReferences = [
    { column: 'tavern_agent_id', table: 'activity_items' },
    { column: 'agent_id', table: 'agent_thought_snapshots' },
    { column: 'agent_id', table: 'memory_peer_mappings' },
    { column: 'agent_id', table: 'messaging_bindings' },
    { column: 'agent_id', table: 'model_selections' },
    { column: 'agent_id', table: 'session_tool_calls' },
] as const;

const sessionKeyReferences = [
    { column: 'session_key', table: 'session_access_events' },
    { column: 'session_key', table: 'session_artifacts' },
    { column: 'session_key', table: 'session_message_parts' },
    { column: 'session_key', table: 'session_messages' },
    { column: 'session_key', table: 'session_tool_calls' },
    { column: 'target_session_key', table: 'session_access_events' },
] as const;

const sessionLinkReferences = [
    { column: 'child_session_key', table: 'session_deliveries' },
    { column: 'child_session_key', table: 'session_links' },
    { column: 'parent_session_key', table: 'session_deliveries' },
    { column: 'parent_session_key', table: 'session_links' },
] as const;

function hasColumn(table: string, column: string) {
    const row = databaseClient
        .query(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = ? LIMIT 1`)
        .get(column);

    return Boolean(row);
}

function deleteColumnValue(table: string, column: string, value: string) {
    if (!hasColumn(table, column)) {
        return;
    }

    databaseClient.query(`DELETE FROM ${table} WHERE ${column} = ?`).run(value);
}

function listSessionKeysForAgent(agentId: string) {
    if (!hasColumn('session_runs', 'agent_id')) {
        return [];
    }

    const records = databaseClient
        .query('SELECT session_key FROM session_runs WHERE agent_id = ?')
        .all(agentId) as Array<{ session_key: string }>;

    return records.map((record) => record.session_key);
}

function deleteSessionRowsForAgent(agentId: string) {
    const sessionKeys = listSessionKeysForAgent(agentId);

    for (const sessionKey of sessionKeys) {
        for (const reference of sessionKeyReferences) {
            deleteColumnValue(reference.table, reference.column, sessionKey);
        }
        for (const reference of sessionLinkReferences) {
            deleteColumnValue(reference.table, reference.column, sessionKey);
        }
    }

    deleteColumnValue('session_runs', 'agent_id', agentId);
}

function deleteAgentReferences(agentId: string) {
    databaseClient.exec('BEGIN');

    try {
        deleteSessionRowsForAgent(agentId);

        for (const reference of directAgentReferences) {
            deleteColumnValue(reference.table, reference.column, agentId);
        }

        databaseClient.exec('COMMIT');
    } catch (error) {
        databaseClient.exec('ROLLBACK');
        throw error;
    }
}
