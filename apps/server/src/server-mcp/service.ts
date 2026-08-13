import type {
    McpConnection,
    McpConnectionCreate,
    McpOAuthStart,
    McpOAuthStartResult,
    McpPreset,
} from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentMcpConnectionGrantsTable,
    mcpConnectionsTable,
    mcpSecretsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { McpDeniedError } from './errors.ts';
import type { McpOAuthRelay } from './oauth-relay.ts';
import { emptySecret, type McpRuntime } from './runtime.ts';
import { shapeMcpConnection } from './state.ts';

export async function createMcpConnection(
    db: GrottoDatabase,
    runtime: McpRuntime,
    member: GrottoUser | null,
    input: McpConnectionCreate,
    preset: McpPreset | null = null
): Promise<McpConnection> {
    await requireAdmin(db, member, input.serverId, 'add a connection');
    const id = createOpaqueId('mcp');
    const shouldConnect =
        input.auth === 'none' ||
        (input.auth === 'headers' && Object.keys(input.headers).length > 0);
    const [row] = await db.transaction(async (tx) => {
        const [connection] = await tx
            .insert(mcpConnectionsTable)
            .values({
                accountLabel: null,
                auth: input.auth,
                connected: false,
                headerNames: Object.keys(input.headers).sort(),
                id,
                name: input.name,
                preset,
                serverId: input.serverId,
                tools: [],
                url: input.url,
            })
            .returning();
        if (!connection) {
            throw new Error('MCP connection was not saved.');
        }
        await tx.insert(mcpSecretsTable).values({
            connectionId: id,
            secret: {
                ...emptySecret(),
                configuredClientInformation: input.oauthClientId
                    ? {
                          client_id: input.oauthClientId,
                          ...(input.oauthClientSecret
                              ? { client_secret: input.oauthClientSecret }
                              : {}),
                      }
                    : undefined,
                headers: input.headers,
                oauthScopes: input.oauthScopes,
            },
        });
        return [connection];
    });
    if (shouldConnect) {
        try {
            return shapeMcpConnection(await refreshInventory(db, runtime, row));
        } catch (cause) {
            await runtime.closeConnection(id);
            await db.delete(mcpConnectionsTable).where(eq(mcpConnectionsTable.id, id));
            throw cause;
        }
    }
    return shapeMcpConnection(row);
}

export async function startMcpOAuth(
    db: GrottoDatabase,
    runtime: McpRuntime,
    relay: McpOAuthRelay,
    member: GrottoUser | null,
    input: McpOAuthStart
): Promise<McpOAuthStartResult> {
    await requireAdmin(db, member, input.serverId, 'connect an account');
    const connection = await requireConnection(db, input);
    if (connection.auth !== 'oauth') {
        throw new McpDeniedError('This OAuth connection was not found.');
    }
    const result = await relay.start({
        allowAuthorizationServerOrigin: input.allowAuthorizationServerOrigin,
        connectionId: input.connectionId,
        redirectUrl: input.redirectUrl,
    });
    if (result.status === 'ready') {
        await clearMcpIdentity(db, runtime, input.serverId, input.connectionId);
    }
    return result;
}

export async function disconnectMcpConnection(
    db: GrottoDatabase,
    runtime: McpRuntime,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
): Promise<McpConnection> {
    const connection = await requireOperableConnection(db, member, input);
    await runtime.closeConnection(input.connectionId);
    const secret = await runtime.readSecret(input.connectionId);
    await db.transaction(async (tx) => {
        await tx
            .delete(agentMcpConnectionGrantsTable)
            .where(eq(agentMcpConnectionGrantsTable.connectionId, input.connectionId));
        await tx
            .update(mcpSecretsTable)
            .set({
                secret: {
                    ...emptySecret(),
                    approvedAuthorizationServerOrigins: secret.approvedAuthorizationServerOrigins,
                    configuredClientInformation: secret.configuredClientInformation,
                    headers: secret.headers,
                    oauthScopes: secret.oauthScopes,
                } as unknown as Record<string, unknown>,
                updatedAt: new Date(),
            })
            .where(eq(mcpSecretsTable.connectionId, input.connectionId));
        await tx
            .update(mcpConnectionsTable)
            .set({ accountLabel: null, connected: false, tools: [] })
            .where(eq(mcpConnectionsTable.id, input.connectionId));
    });
    return shapeMcpConnection({
        ...connection,
        accountLabel: null,
        connected: false,
        tools: [],
    });
}

export async function deleteMcpConnection(
    db: GrottoDatabase,
    runtime: McpRuntime,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
): Promise<McpConnection> {
    const connection = await requireOperableConnection(db, member, input);
    if (connection.preset) {
        throw new McpDeniedError('Recommended connections cannot be deleted.');
    }
    await runtime.closeConnection(input.connectionId);
    await db.delete(mcpConnectionsTable).where(eq(mcpConnectionsTable.id, input.connectionId));
    return shapeMcpConnection(connection);
}

export async function refreshMcpConnection(
    db: GrottoDatabase,
    runtime: McpRuntime,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
): Promise<McpConnection> {
    const connection = await requireOperableConnection(db, member, input);
    return shapeMcpConnection(await refreshInventory(db, runtime, connection));
}

export async function replaceMcpHeaders(
    db: GrottoDatabase,
    runtime: McpRuntime,
    member: GrottoUser | null,
    input: { connectionId: string; headers: Record<string, string>; serverId: string }
): Promise<McpConnection> {
    const connection = await requireOperableConnection(db, member, input);
    if (connection.auth !== 'headers') {
        throw new McpDeniedError('This MCP connection does not use header credentials.');
    }
    await runtime.closeConnection(input.connectionId);
    const secret = await runtime.readSecret(input.connectionId);
    await runtime.writeSecret(input.connectionId, { ...secret, headers: input.headers });
    const updated = await db
        .update(mcpConnectionsTable)
        .set({
            accountLabel: null,
            connected: false,
            headerNames: Object.keys(input.headers).sort(),
            tools: [],
        })
        .where(eq(mcpConnectionsTable.id, input.connectionId))
        .returning();
    await db
        .delete(agentMcpConnectionGrantsTable)
        .where(eq(agentMcpConnectionGrantsTable.connectionId, input.connectionId));
    const row = updated[0];
    if (!row) {
        throw new Error('MCP headers were not saved.');
    }
    return Object.keys(input.headers).length > 0
        ? shapeMcpConnection(await refreshInventory(db, runtime, row))
        : shapeMcpConnection(row);
}

export async function clearMcpIdentity(
    db: GrottoDatabase,
    runtime: McpRuntime,
    serverId: string,
    connectionId: string
) {
    await runtime.closeConnection(connectionId);
    await db.transaction(async (tx) => {
        await tx
            .delete(agentMcpConnectionGrantsTable)
            .where(eq(agentMcpConnectionGrantsTable.connectionId, connectionId));
        await tx
            .update(mcpConnectionsTable)
            .set({ accountLabel: null, connected: false, tools: [] })
            .where(
                and(
                    eq(mcpConnectionsTable.serverId, serverId),
                    eq(mcpConnectionsTable.id, connectionId)
                )
            );
    });
}

async function refreshInventory(
    db: GrottoDatabase,
    runtime: McpRuntime,
    connection: typeof mcpConnectionsTable.$inferSelect
) {
    await runtime.closeConnection(connection.id);
    const discovery = await runtime.discover(connection.id);
    const [updated] = await db
        .update(mcpConnectionsTable)
        .set({
            accountLabel: discovery.accountLabel,
            connected: true,
            tools: [...new Set(discovery.tools)].sort(),
        })
        .where(eq(mcpConnectionsTable.id, connection.id))
        .returning();
    if (!updated) {
        throw new Error('MCP inventory was not saved.');
    }
    return updated;
}

async function requireAdmin(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string,
    action: string
) {
    const access = await requireServerMembership(db, member, serverId);
    if (!member || (access.role !== 'owner' && access.role !== 'admin')) {
        throw new McpDeniedError(`Only a Server Owner or Admin can ${action}.`);
    }
}

async function requireConnection(
    db: GrottoDatabase,
    input: { connectionId: string; serverId: string }
) {
    const [row] = await db
        .select()
        .from(mcpConnectionsTable)
        .where(
            and(
                eq(mcpConnectionsTable.serverId, input.serverId),
                eq(mcpConnectionsTable.id, input.connectionId)
            )
        )
        .limit(1);
    if (!row) {
        throw new McpDeniedError('The MCP connection was not found.');
    }
    return row;
}

async function requireOperableConnection(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
) {
    await requireAdmin(db, member, input.serverId, 'change a connection');
    return await requireConnection(db, input);
}
