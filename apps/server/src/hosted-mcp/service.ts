import type { HostedMcpConnection, HostedMcpConnectionCreate, HostedMcpGrant } from '@tavern/api';
import { and, asc, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentMcpToolGrantsTable,
    agentsTable,
    computersTable,
    mcpConnectionsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export class HostedMcpDeniedError extends Error {}

export async function createHostedMcpConnection(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: HostedMcpConnectionCreate
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
        command: input.command ?? null,
        env: input.env,
        headers: input.headers,
        id,
        name: input.name,
        url: input.url ?? null,
    };
    const [row] = await db
        .insert(mcpConnectionsTable)
        .values({
            args: input.args,
            auth: Object.keys(input.headers).length > 0 ? 'headers' : 'none',
            command: input.command ?? null,
            computerId: computer.id,
            headerNames: Object.keys(input.headers).sort(),
            id,
            name: input.name,
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
    return shape(row, connections);
}

export async function listHostedMcpConnections(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    serverId: string
): Promise<HostedMcpConnection[]> {
    await requireServerMembership(db, member, serverId);
    const rows = await db
        .select()
        .from(mcpConnectionsTable)
        .where(eq(mcpConnectionsTable.serverId, serverId))
        .orderBy(asc(mcpConnectionsTable.name));
    return rows.map((row) => shape(row, connections));
}

export async function setHostedMcpGrant(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: HostedMcpGrant & { enabled: boolean; serverId: string }
): Promise<HostedMcpGrant> {
    const access = await requireServerMembership(db, member, input.serverId);
    if (!member || (access.role !== 'owner' && access.role !== 'admin')) {
        throw new HostedMcpDeniedError('Only a Server Owner or Admin can change tool grants.');
    }
    const [scope] = await db
        .select({
            agentComputerId: agentsTable.computerId,
            connectionComputerId: mcpConnectionsTable.computerId,
            tools: mcpConnectionsTable.tools,
        })
        .from(agentsTable)
        .innerJoin(
            mcpConnectionsTable,
            and(
                eq(mcpConnectionsTable.serverId, agentsTable.serverId),
                eq(mcpConnectionsTable.id, input.connectionId)
            )
        )
        .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
        .limit(1);
    if (
        !scope?.agentComputerId ||
        scope.agentComputerId !== scope.connectionComputerId ||
        !scope.tools.includes(input.toolName)
    ) {
        throw new HostedMcpDeniedError('The Agent and tool must belong to the same Computer.');
    }
    const key = {
        agentId: input.agentId,
        connectionId: input.connectionId,
        serverId: input.serverId,
        toolName: input.toolName,
    };
    if (input.enabled) {
        await db.insert(agentMcpToolGrantsTable).values(key).onConflictDoNothing();
    } else {
        await db
            .delete(agentMcpToolGrantsTable)
            .where(
                and(
                    eq(agentMcpToolGrantsTable.serverId, input.serverId),
                    eq(agentMcpToolGrantsTable.agentId, input.agentId),
                    eq(agentMcpToolGrantsTable.connectionId, input.connectionId),
                    eq(agentMcpToolGrantsTable.toolName, input.toolName)
                )
            );
    }
    connections.sendMcpGrant(scope.connectionComputerId, {
        agentId: input.agentId,
        connectionId: input.connectionId,
        enabled: input.enabled,
        toolName: input.toolName,
    });
    return key;
}

export async function recordHostedMcpInventory(
    db: GrottoDatabase,
    computerId: string,
    input: { connectionId: string; tools: string[] }
): Promise<void> {
    await db
        .update(mcpConnectionsTable)
        .set({ tools: [...new Set(input.tools)].sort() })
        .where(
            and(
                eq(mcpConnectionsTable.id, input.connectionId),
                eq(mcpConnectionsTable.computerId, computerId)
            )
        );
}

function shape(
    row: typeof mcpConnectionsTable.$inferSelect,
    connections: ComputerConnections
): HostedMcpConnection {
    return {
        ...row,
        status: connections.isOnline(row.computerId) ? 'online' : 'pending',
    };
}
