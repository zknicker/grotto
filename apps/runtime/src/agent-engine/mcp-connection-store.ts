import type { AgentRuntimeMcpConnectionCreate } from '@tavern/api';
import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

const secretPrefix = 'mcp:';

const storedSecretSchema = z.object({
    accountLabel: z.string().nullable().optional(),
    approvedAuthorizationServerOrigins: z.array(z.string().url()).default([]),
    authorizationServerInformation: z.record(z.string(), z.unknown()).optional(),
    clientInformation: z.record(z.string(), z.unknown()).optional(),
    configuredClientInformation: z.record(z.string(), z.unknown()).optional(),
    env: z.record(z.string(), z.string()).default({}),
    headers: z.record(z.string(), z.string()).default({}),
    oauthScopes: z.array(z.string()).default([]),
    oauthState: z.string().optional(),
    tokens: z.record(z.string(), z.unknown()).optional(),
    verifier: z.string().optional(),
});

export type StoredMcpSecret = z.infer<typeof storedSecretSchema>;
type StoredMcpSecretInput = z.input<typeof storedSecretSchema>;

export interface McpConnectionRow {
    args_json: string;
    auth: 'headers' | 'none' | 'oauth';
    command: string | null;
    header_names_json: string;
    id: string;
    name: string;
    preset: 'google-calendar' | 'merchbase' | null;
    transport: 'http' | 'stdio';
    url: string | null;
}

export function readMcpConnectionRow(id: string, db: Database) {
    return db
        .prepare('SELECT * FROM mcp_connections WHERE id = $id')
        .get(namedParams({ id })) as McpConnectionRow | null;
}

export function listMcpConnectionRows(db: Database) {
    return db
        .prepare('SELECT * FROM mcp_connections ORDER BY preset DESC, name, id')
        .all() as McpConnectionRow[];
}

export function saveMcpConnection(
    id: string,
    input: AgentRuntimeMcpConnectionCreate,
    preset: McpConnectionRow['preset'],
    db: Database
) {
    const now = new Date().toISOString();
    const transport = input.command ? 'stdio' : 'http';
    db.prepare(
        `INSERT INTO mcp_connections
         (id, name, preset, transport, auth, url, command, args_json,
          header_names_json, created_at, updated_at)
         VALUES ($id, $name, $preset, $transport, $auth, $url, $command,
                 $argsJson, $headerNamesJson, $now, $now)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           transport = excluded.transport,
           auth = excluded.auth,
           url = excluded.url,
           command = excluded.command,
           args_json = excluded.args_json,
           header_names_json = excluded.header_names_json,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            argsJson: JSON.stringify(input.args ?? []),
            auth: input.auth,
            command: input.command ?? null,
            headerNamesJson: JSON.stringify(Object.keys(input.headers ?? {}).sort()),
            id,
            name: input.name,
            now,
            preset,
            transport,
            url: input.url ?? null,
        })
    );
}

export function readMcpSecret(id: string, db: Database = getDb()): StoredMcpSecret {
    const row = db
        .prepare('SELECT secret_json FROM tavern_vault_secrets WHERE id = $id')
        .get(namedParams({ id: `${secretPrefix}${id}` })) as { secret_json: string } | undefined;
    if (!row) {
        return { approvedAuthorizationServerOrigins: [], env: {}, headers: {}, oauthScopes: [] };
    }
    return storedSecretSchema.parse(JSON.parse(row.secret_json));
}

export function writeMcpSecret(id: string, secret: StoredMcpSecretInput, db: Database = getDb()) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO tavern_vault_secrets (id, secret_json, created_at, updated_at)
         VALUES ($id, $secretJson, $now, $now)
         ON CONFLICT(id) DO UPDATE SET
           secret_json = excluded.secret_json,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            id: `${secretPrefix}${id}`,
            now,
            secretJson: JSON.stringify(storedSecretSchema.parse(secret)),
        })
    );
}

export function listAffectedAgents(connectionId: string, db: Database = getDb()) {
    return db
        .prepare(
            `SELECT DISTINCT agents.id, agents.name
             FROM agent_mcp_tool_grants
             JOIN agents ON agents.id = agent_mcp_tool_grants.agent_id
             WHERE connection_id = $connectionId
             ORDER BY agents.name, agents.id`
        )
        .all(namedParams({ connectionId })) as Array<{ id: string; name: string }>;
}

export function listAgentMcpToolGrants(agentId: string, db: Database = getDb()) {
    return db
        .prepare(
            `SELECT agent_id AS agentId, connection_id AS connectionId, tool_name AS toolName
             FROM agent_mcp_tool_grants
             WHERE agent_id = $agentId
             ORDER BY connection_id, tool_name`
        )
        .all(namedParams({ agentId })) as Array<{
        agentId: string;
        connectionId: string;
        toolName: string;
    }>;
}

export function hasAgentMcpToolGrant(
    agentId: string,
    connectionId: string,
    toolName: string,
    db: Database = getDb()
) {
    return Boolean(
        db
            .prepare(
                `SELECT 1 FROM agent_mcp_tool_grants
                 WHERE agent_id = $agentId
                   AND connection_id = $connectionId
                   AND tool_name = $toolName`
            )
            .get(namedParams({ agentId, connectionId, toolName }))
    );
}

export function setAgentMcpToolGrant(
    input: {
        agentId: string;
        connectionId: string;
        enabled: boolean;
        toolName: string;
    },
    db: Database = getDb()
) {
    const now = new Date().toISOString();
    if (!input.enabled) {
        db.prepare(
            `DELETE FROM agent_mcp_tool_grants
             WHERE agent_id = $agentId AND connection_id = $connectionId
               AND tool_name = $toolName`
        ).run(namedParams(input));
        return;
    }
    db.prepare(
        `INSERT INTO agent_mcp_tool_grants
         (agent_id, connection_id, tool_name, created_at, updated_at)
         VALUES ($agentId, $connectionId, $toolName, $now, $now)
         ON CONFLICT(agent_id, connection_id, tool_name) DO UPDATE SET
           updated_at = excluded.updated_at`
    ).run(namedParams({ ...input, now }));
}
