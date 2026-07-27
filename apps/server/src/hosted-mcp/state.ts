import type { HostedMcpConnection, HostedMcpGrant } from '@tavern/api';
import { and, asc, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentMcpToolGrantsTable, agentsTable, mcpConnectionsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { HostedMcpDeniedError } from './errors.ts';

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
    const grants = await db
        .select({
            agentId: agentMcpToolGrantsTable.agentId,
            connectionId: agentMcpToolGrantsTable.connectionId,
            toolName: agentMcpToolGrantsTable.toolName,
        })
        .from(agentMcpToolGrantsTable)
        .where(eq(agentMcpToolGrantsTable.serverId, serverId));
    return rows.map((row) =>
        shapeHostedMcpConnection(
            row,
            connections,
            grants.filter((grant) => grant.connectionId === row.id)
        )
    );
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
    return {
        agentId: input.agentId,
        connectionId: input.connectionId,
        toolName: input.toolName,
    };
}

export async function recordHostedMcpInventory(
    db: GrottoDatabase,
    computerId: string,
    input: {
        accountLabel: string | null;
        connected: boolean;
        connectionId: string;
        tools: string[];
    }
): Promise<void> {
    await db
        .update(mcpConnectionsTable)
        .set({
            accountLabel: input.accountLabel,
            connected: input.connected,
            tools: [...new Set(input.tools)].sort(),
        })
        .where(
            and(
                eq(mcpConnectionsTable.id, input.connectionId),
                eq(mcpConnectionsTable.computerId, computerId)
            )
        );
}

export async function clearHostedMcpIdentity(
    db: GrottoDatabase,
    serverId: string,
    connectionId: string
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .delete(agentMcpToolGrantsTable)
            .where(
                and(
                    eq(agentMcpToolGrantsTable.serverId, serverId),
                    eq(agentMcpToolGrantsTable.connectionId, connectionId)
                )
            );
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

export function shapeHostedMcpConnection(
    row: typeof mcpConnectionsTable.$inferSelect,
    connections: ComputerConnections,
    grants: HostedMcpGrant[] = []
): HostedMcpConnection {
    return {
        accountLabel: row.accountLabel,
        args: row.args,
        auth: row.auth,
        command: row.command,
        computerId: row.computerId,
        connected: row.connected,
        grants,
        headerNames: row.headerNames,
        id: row.id,
        name: row.name,
        preset: row.preset,
        serverId: row.serverId,
        status: connections.isOnline(row.computerId) ? 'online' : 'pending',
        tools: row.tools,
        transport: row.transport,
        url: row.url,
    };
}
