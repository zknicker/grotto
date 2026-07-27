import type {
    HostedMcpConnection,
    HostedMcpConnectionCreate,
    HostedMcpOAuthStart,
    HostedMcpOAuthStartResult,
    HostedMcpPreset,
} from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentMcpToolGrantsTable,
    computersTable,
    mcpConnectionsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { HostedMcpDeniedError } from './errors.ts';
import type { HostedMcpOAuthRelay } from './oauth-relay.ts';
import { clearHostedMcpIdentity, shapeHostedMcpConnection } from './state.ts';

export async function createHostedMcpConnection(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: HostedMcpConnectionCreate,
    preset: HostedMcpPreset | null = null
): Promise<HostedMcpConnection> {
    const access = await requireServerMembership(db, member, input.serverId);
    if (!member || (access.role !== 'owner' && access.role !== 'admin')) {
        throw new HostedMcpDeniedError('Only a Server Owner or Admin can add a connection.');
    }
    const [computer] = await db
        .select({ id: computersTable.id })
        .from(computersTable)
        .where(
            and(
                eq(computersTable.serverId, input.serverId),
                eq(computersTable.id, input.computerId)
            )
        )
        .limit(1);
    if (!(computer && connections.isOnline(computer.id))) {
        throw new HostedMcpDeniedError('The selected Computer must be online.');
    }

    const id = createOpaqueId('mcp');
    const secretConnection = {
        args: input.args,
        auth: input.auth,
        command: input.command ?? null,
        env: input.env,
        headers: input.headers,
        id,
        name: input.name,
        oauthClientId: input.oauthClientId,
        oauthClientSecret: input.oauthClientSecret,
        oauthScopes: input.oauthScopes,
        preset,
        url: input.url ?? null,
    };
    const [row] = await db
        .insert(mcpConnectionsTable)
        .values({
            accountLabel: null,
            args: input.args,
            auth: input.auth,
            command: input.command ?? null,
            computerId: computer.id,
            connected:
                input.auth === 'none' ||
                (input.auth === 'headers' && Object.keys(input.headers).length > 0),
            headerNames: Object.keys(input.headers).sort(),
            id,
            name: input.name,
            preset,
            serverId: input.serverId,
            tools: [],
            transport: input.command ? 'stdio' : 'http',
            url: input.url ?? null,
        })
        .returning();
    if (!row) {
        throw new Error('MCP connection was not saved.');
    }
    if (!connections.sendMcpConnection(computer.id, secretConnection)) {
        await db.delete(mcpConnectionsTable).where(eq(mcpConnectionsTable.id, id));
        throw new HostedMcpDeniedError('The selected Computer went offline.');
    }
    return shapeHostedMcpConnection(row, connections);
}

export async function startHostedMcpOAuth(
    db: GrottoDatabase,
    connections: ComputerConnections,
    relay: HostedMcpOAuthRelay,
    member: GrottoUser | null,
    input: HostedMcpOAuthStart
): Promise<HostedMcpOAuthStartResult> {
    const access = await requireServerMembership(db, member, input.serverId);
    if (!member || (access.role !== 'owner' && access.role !== 'admin')) {
        throw new HostedMcpDeniedError('Only a Server Owner or Admin can connect an account.');
    }
    const [connection] = await db
        .select({
            auth: mcpConnectionsTable.auth,
            computerId: mcpConnectionsTable.computerId,
        })
        .from(mcpConnectionsTable)
        .where(
            and(
                eq(mcpConnectionsTable.serverId, input.serverId),
                eq(mcpConnectionsTable.id, input.connectionId)
            )
        )
        .limit(1);
    if (!connection || connection.auth !== 'oauth') {
        throw new HostedMcpDeniedError('This OAuth connection was not found.');
    }
    if (!connections.isOnline(connection.computerId)) {
        throw new HostedMcpDeniedError(
            'The selected Computer is offline. Bring it online and try again.'
        );
    }
    const result = await relay.start({
        allowAuthorizationServerOrigin: input.allowAuthorizationServerOrigin,
        computerId: connection.computerId,
        connectionId: input.connectionId,
        redirectUrl: input.redirectUrl,
    });
    if (result.status === 'ready') {
        await clearHostedMcpIdentity(db, input.serverId, input.connectionId);
    }
    return result;
}

export async function disconnectHostedMcpConnection(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
): Promise<HostedMcpConnection> {
    const connection = await requireOperableConnection(db, connections, member, input);
    if (!connections.sendMcpControl(connection.computerId, 'mcp-disconnect', input.connectionId)) {
        throw new HostedMcpDeniedError('The selected Computer went offline.');
    }
    await db.transaction(async (tx) => {
        await tx
            .delete(agentMcpToolGrantsTable)
            .where(
                and(
                    eq(agentMcpToolGrantsTable.serverId, input.serverId),
                    eq(agentMcpToolGrantsTable.connectionId, input.connectionId)
                )
            );
        await tx
            .update(mcpConnectionsTable)
            .set({ accountLabel: null, connected: false, tools: [] })
            .where(
                and(
                    eq(mcpConnectionsTable.serverId, input.serverId),
                    eq(mcpConnectionsTable.id, input.connectionId)
                )
            );
    });
    return shapeHostedMcpConnection(
        { ...connection, accountLabel: null, connected: false, tools: [] },
        connections
    );
}

export async function deleteHostedMcpConnection(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
): Promise<HostedMcpConnection> {
    const connection = await requireOperableConnection(db, connections, member, input);
    if (connection.preset) {
        throw new HostedMcpDeniedError('Built-in preset connections cannot be deleted.');
    }
    if (!connections.sendMcpControl(connection.computerId, 'mcp-delete', input.connectionId)) {
        throw new HostedMcpDeniedError('The selected Computer went offline.');
    }
    await db
        .delete(mcpConnectionsTable)
        .where(
            and(
                eq(mcpConnectionsTable.serverId, input.serverId),
                eq(mcpConnectionsTable.id, input.connectionId)
            )
        );
    return shapeHostedMcpConnection(connection, connections);
}

export async function refreshHostedMcpConnection(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
): Promise<HostedMcpConnection> {
    const connection = await requireOperableConnection(db, connections, member, input);
    if (!connections.sendMcpControl(connection.computerId, 'mcp-refresh', input.connectionId)) {
        throw new HostedMcpDeniedError('The selected Computer went offline.');
    }
    return shapeHostedMcpConnection(connection, connections);
}

export async function replaceHostedMcpHeaders(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { connectionId: string; headers: Record<string, string>; serverId: string }
): Promise<HostedMcpConnection> {
    const connection = await requireOperableConnection(db, connections, member, input);
    if (connection.auth !== 'headers') {
        throw new HostedMcpDeniedError('This MCP connection does not use header credentials.');
    }
    if (!connections.sendMcpHeaders(connection.computerId, input.connectionId, input.headers)) {
        throw new HostedMcpDeniedError('The selected Computer went offline.');
    }
    await db.transaction(async (tx) => {
        await tx
            .delete(agentMcpToolGrantsTable)
            .where(
                and(
                    eq(agentMcpToolGrantsTable.serverId, input.serverId),
                    eq(agentMcpToolGrantsTable.connectionId, input.connectionId)
                )
            );
        await tx
            .update(mcpConnectionsTable)
            .set({
                accountLabel: null,
                connected: false,
                headerNames: Object.keys(input.headers).sort(),
                tools: [],
            })
            .where(eq(mcpConnectionsTable.id, input.connectionId));
    });
    return shapeHostedMcpConnection(
        {
            ...connection,
            accountLabel: null,
            connected: false,
            headerNames: Object.keys(input.headers).sort(),
            tools: [],
        },
        connections
    );
}

async function requireOperableConnection(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { connectionId: string; serverId: string }
) {
    const access = await requireServerMembership(db, member, input.serverId);
    if (!member || (access.role !== 'owner' && access.role !== 'admin')) {
        throw new HostedMcpDeniedError('Only a Server Owner or Admin can change a connection.');
    }
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
        throw new HostedMcpDeniedError('The MCP connection was not found.');
    }
    if (!connections.isOnline(row.computerId)) {
        throw new HostedMcpDeniedError(
            'The selected Computer is offline. Bring it online and try again.'
        );
    }
    return row;
}
