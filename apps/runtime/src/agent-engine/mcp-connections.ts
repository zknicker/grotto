import { randomUUID } from 'node:crypto';
import {
    type AgentRuntimeMcpConnection,
    type AgentRuntimeMcpConnectionCreate,
    type AgentRuntimeMcpConnectionUpdate,
    type AgentRuntimeMcpPresetAccountCreate,
    agentRuntimeMcpConnectionCreateSchema,
    agentRuntimeMcpConnectionSchema,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    builtInMcpConnections,
    configuredMcpSecret,
    getBuiltInMcpConnection,
    isSeededBuiltIn,
    parseMcpStringArray,
    sameMcpSecretConfiguration,
    seededIdentityChanged,
    slugifyMcpConnectionName,
    stringArraysEqual,
} from './mcp-connection-config.ts';
import {
    listAffectedAgents,
    listMcpConnectionRows,
    type McpConnectionRow,
    readMcpConnectionRow,
    readMcpSecret,
    saveMcpConnection,
    writeMcpSecret,
} from './mcp-connection-store.ts';

export type { StoredMcpSecret } from './mcp-connection-store.ts';
export {
    hasAgentMcpToolGrant,
    listAffectedAgents,
    listAgentMcpToolGrants,
    readMcpSecret,
    setAgentMcpToolGrant,
    writeMcpSecret,
} from './mcp-connection-store.ts';

export function ensureBuiltInMcpConnections(db: Database = getDb()) {
    const now = new Date().toISOString();
    const insert = db.prepare(
        `INSERT INTO mcp_connections
         (id, name, preset, transport, auth, url, command, args_json,
          header_names_json, created_at, updated_at)
         VALUES ($id, $name, $preset, 'http', $auth, $url, NULL, '[]', '[]', $now, $now)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           preset = excluded.preset,
           transport = excluded.transport,
           auth = excluded.auth,
           url = excluded.url,
           command = excluded.command,
           args_json = excluded.args_json,
           header_names_json = excluded.header_names_json,
           updated_at = excluded.updated_at
         WHERE mcp_connections.name <> excluded.name
            OR mcp_connections.preset <> excluded.preset
            OR mcp_connections.transport <> excluded.transport
            OR mcp_connections.auth <> excluded.auth
            OR mcp_connections.url <> excluded.url
            OR mcp_connections.command IS NOT excluded.command
            OR mcp_connections.args_json <> excluded.args_json
            OR mcp_connections.header_names_json <> excluded.header_names_json`
    );
    for (const connection of builtInMcpConnections) {
        const existing = readMcpConnectionRow(connection.id, db);
        if (existing && seededIdentityChanged(existing, connection)) {
            db.prepare('DELETE FROM tavern_vault_secrets WHERE id = $id').run(
                namedParams({ id: `mcp:${connection.id}` })
            );
            db.prepare('DELETE FROM agent_mcp_tool_grants WHERE connection_id = $id').run(
                namedParams({ id: connection.id })
            );
        }
        insert.run(namedParams({ ...connection, now }));
    }
}

export function listMcpConnections(db: Database = getDb()): AgentRuntimeMcpConnection[] {
    ensureBuiltInMcpConnections(db);
    return listMcpConnectionRows(db).map((row) => toApiConnection(row, db));
}

export function getMcpConnection(id: string, db: Database = getDb()) {
    ensureBuiltInMcpConnections(db);
    const row = readMcpConnectionRow(id, db);
    return row ? { api: toApiConnection(row, db), row, secret: readMcpSecret(id, db) } : null;
}

export function createMcpConnection(
    input: AgentRuntimeMcpConnectionCreate,
    db: Database = getDb()
) {
    const validated = agentRuntimeMcpConnectionCreateSchema.parse(input);
    const id = uniqueConnectionId(slugifyMcpConnectionName(validated.name), db);
    db.exec('BEGIN IMMEDIATE');
    try {
        saveMcpConnection(id, validated, null, db);
        writeMcpSecret(id, configuredMcpSecret(validated), db);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return getMcpConnection(id, db)?.api;
}

export function createPresetMcpConnection(
    input: AgentRuntimeMcpPresetAccountCreate,
    db: Database = getDb()
) {
    const preset = getBuiltInMcpConnection(input.preset);
    if (!preset) {
        throw new Error('Unknown MCP preset.');
    }
    const connection = agentRuntimeMcpConnectionCreateSchema.parse({
        auth: 'oauth',
        name: input.name,
        url: preset.url,
    });
    const id = uniqueConnectionId(slugifyMcpConnectionName(connection.name), db);
    db.exec('BEGIN IMMEDIATE');
    try {
        saveMcpConnection(id, connection, preset.preset, db);
        writeMcpSecret(id, configuredMcpSecret(connection), db);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return getMcpConnection(id, db)?.api;
}

export function updateMcpConnection(
    id: string,
    input: AgentRuntimeMcpConnectionUpdate,
    db: Database = getDb()
) {
    const existing = getMcpConnection(id, db);
    if (!existing) {
        return null;
    }
    if (isSeededBuiltIn(id)) {
        throw new Error('The default built-in connection cannot be changed.');
    }
    if (existing.row.preset && Object.keys(input).some((key) => key !== 'name')) {
        throw new Error('Preset account connection settings cannot be changed.');
    }

    const endpointIdentityChanged =
        (input.auth !== undefined && input.auth !== existing.api.auth) ||
        (input.command !== undefined && input.command !== existing.api.command) ||
        (input.url !== undefined && input.url !== existing.api.url) ||
        (input.args !== undefined && !stringArraysEqual(input.args, existing.api.args));
    const configured = existing.secret.configuredClientInformation;
    const existingClientId =
        typeof configured?.client_id === 'string' ? configured.client_id : undefined;
    const existingClientSecret =
        typeof configured?.client_secret === 'string' ? configured.client_secret : undefined;
    const oauthClientId =
        input.oauthClientId === null
            ? undefined
            : (input.oauthClientId ?? (endpointIdentityChanged ? undefined : existingClientId));
    const oauthClientSecret =
        input.oauthClientSecret === null
            ? undefined
            : (input.oauthClientSecret ??
              (endpointIdentityChanged || oauthClientId !== existingClientId
                  ? undefined
                  : existingClientSecret));
    const merged = agentRuntimeMcpConnectionCreateSchema.parse({
        args: input.args ?? existing.api.args,
        auth: input.auth ?? existing.api.auth,
        command:
            input.command === null
                ? undefined
                : (input.command ?? existing.api.command ?? undefined),
        env: input.env ?? (endpointIdentityChanged ? undefined : existing.secret.env),
        headers: input.headers ?? (endpointIdentityChanged ? undefined : existing.secret.headers),
        name: input.name ?? existing.api.name,
        oauthClientId,
        oauthClientSecret,
        oauthScopes:
            input.oauthScopes === null
                ? undefined
                : (input.oauthScopes ??
                  (endpointIdentityChanged ? undefined : existing.secret.oauthScopes)),
        url: input.url === null ? undefined : (input.url ?? existing.api.url ?? undefined),
    });
    const nextSecretConfiguration = configuredMcpSecret(merged);
    const identityChanged =
        endpointIdentityChanged ||
        !sameMcpSecretConfiguration(existing.secret, nextSecretConfiguration);

    db.exec('BEGIN IMMEDIATE');
    try {
        saveMcpConnection(id, merged, existing.row.preset, db);
        writeMcpSecret(
            id,
            identityChanged
                ? nextSecretConfiguration
                : { ...existing.secret, ...nextSecretConfiguration },
            db
        );
        if (identityChanged) {
            db.prepare('DELETE FROM agent_mcp_tool_grants WHERE connection_id = $id').run(
                namedParams({ id })
            );
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return getMcpConnection(id, db)?.api ?? null;
}

export function disconnectMcpConnection(id: string, db: Database = getDb()) {
    const affectedAgents = listAffectedAgents(id, db);
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('DELETE FROM tavern_vault_secrets WHERE id = $id').run(
            namedParams({ id: `mcp:${id}` })
        );
        db.prepare('DELETE FROM agent_mcp_tool_grants WHERE connection_id = $id').run(
            namedParams({ id })
        );
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return affectedAgents;
}

export function deleteMcpConnection(id: string, db: Database = getDb()) {
    const connection = getMcpConnection(id, db);
    if (!connection) {
        return null;
    }
    if (isSeededBuiltIn(id)) {
        throw new Error('The default built-in connection cannot be deleted.');
    }
    const affectedAgents = listAffectedAgents(id, db);
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('DELETE FROM mcp_connections WHERE id = $id').run(namedParams({ id }));
        db.prepare('DELETE FROM tavern_vault_secrets WHERE id = $id').run(
            namedParams({ id: `mcp:${id}` })
        );
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return affectedAgents;
}

function toApiConnection(row: McpConnectionRow, db: Database) {
    const secret = readMcpSecret(row.id, db);
    return agentRuntimeMcpConnectionSchema.parse({
        accountLabel: secret.accountLabel ?? null,
        affectedAgents: listAffectedAgents(row.id, db),
        args: parseMcpStringArray(row.args_json),
        auth: row.auth,
        builtIn: isSeededBuiltIn(row.id),
        command: row.command,
        connected:
            row.auth === 'none' ||
            (row.auth === 'headers' && Object.keys(secret.headers).length > 0) ||
            (row.auth === 'oauth' && Boolean(secret.tokens)),
        headerNames: parseMcpStringArray(row.header_names_json),
        id: row.id,
        name: row.name,
        preset: row.preset,
        transport: row.transport,
        url: row.url,
    });
}

function uniqueConnectionId(base: string, db: Database) {
    let id = base || randomUUID();
    for (let suffix = 2; getMcpConnection(id, db); suffix += 1) {
        id = `${base}-${suffix}`;
    }
    return id;
}
