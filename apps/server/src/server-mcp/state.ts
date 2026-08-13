import type { McpConnection, McpGrant } from '@tavern/api';
import { and, asc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentMcpConnectionGrantsTable,
    agentsTable,
    mcpConnectionsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { McpDeniedError } from './errors.ts';

export async function listMcpConnections(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<McpConnection[]> {
    await requireServerMembership(db, member, serverId);
    const rows = await db
        .select()
        .from(mcpConnectionsTable)
        .where(eq(mcpConnectionsTable.serverId, serverId))
        .orderBy(asc(mcpConnectionsTable.name));
    const grants = await db
        .select({
            agentId: agentMcpConnectionGrantsTable.agentId,
            connectionId: agentMcpConnectionGrantsTable.connectionId,
        })
        .from(agentMcpConnectionGrantsTable)
        .where(eq(agentMcpConnectionGrantsTable.serverId, serverId));
    return rows.map((row) =>
        shapeMcpConnection(
            row,
            grants.filter((grant) => grant.connectionId === row.id)
        )
    );
}

export async function setMcpGrant(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: McpGrant & { enabled: boolean; serverId: string }
): Promise<McpGrant> {
    const access = await requireServerMembership(db, member, input.serverId);
    if (!member || (access.role !== 'owner' && access.role !== 'admin')) {
        throw new McpDeniedError('Only a Server Owner or Admin can change Agent access.');
    }
    const [scope] = await db
        .select({ connected: mcpConnectionsTable.connected })
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
    if (!scope) {
        throw new McpDeniedError('The Agent and MCP connection must share a Server.');
    }
    if (input.enabled && !scope.connected) {
        throw new McpDeniedError('Connect this MCP server before enabling Agent access.');
    }
    const key = {
        agentId: input.agentId,
        connectionId: input.connectionId,
        serverId: input.serverId,
    };
    if (input.enabled) {
        await db.insert(agentMcpConnectionGrantsTable).values(key).onConflictDoNothing();
    } else {
        await db
            .delete(agentMcpConnectionGrantsTable)
            .where(
                and(
                    eq(agentMcpConnectionGrantsTable.serverId, input.serverId),
                    eq(agentMcpConnectionGrantsTable.agentId, input.agentId),
                    eq(agentMcpConnectionGrantsTable.connectionId, input.connectionId)
                )
            );
    }
    return { agentId: input.agentId, connectionId: input.connectionId };
}

export function shapeMcpConnection(
    row: typeof mcpConnectionsTable.$inferSelect,
    grants: McpGrant[] = []
): McpConnection {
    return {
        accountLabel: row.accountLabel,
        auth: row.auth,
        connected: row.connected,
        grants,
        headerNames: row.headerNames,
        id: row.id,
        name: row.name,
        preset: row.preset,
        serverId: row.serverId,
        status: row.connected ? 'online' : 'pending',
        tools: row.tools,
        url: row.url,
    };
}
