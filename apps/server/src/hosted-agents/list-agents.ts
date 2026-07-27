import type { HostedAgent } from '@tavern/api';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { type ConfiguredAgentRow, toHostedAgent } from './agent-shape.ts';

/** Lists every configured Agent with its desired config and effective status. */
export async function listHostedAgents(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<HostedAgent[]> {
    await requireServerMembership(db, member, serverId);

    if (!member) {
        return [];
    }

    const agentDm = alias(chatsTable, 'agent_dm');
    const rows = await db
        .select({
            computerId: agentsTable.computerId,
            createdAt: agentsTable.createdAt,
            desiredModelId: agentsTable.desiredModelId,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            displayName: agentsTable.displayName,
            dmChatId: agentDm.id,
            effectiveMissing: agentsTable.effectiveMissing,
            effectiveModelId: agentsTable.effectiveModelId,
            effectiveReportedAt: agentsTable.effectiveReportedAt,
            effectiveRuntimeId: agentsTable.effectiveRuntimeId,
            handle: agentsTable.handle,
            id: agentsTable.id,
            role: agentsTable.role,
            serverId: agentsTable.serverId,
        })
        .from(agentsTable)
        .leftJoin(
            agentDm,
            and(
                eq(agentDm.serverId, agentsTable.serverId),
                eq(agentDm.dmAgentId, agentsTable.id),
                eq(agentDm.dmMemberOneUserId, member.id),
                eq(agentDm.kind, 'dm')
            )
        )
        .where(
            and(
                eq(agentsTable.serverId, serverId),
                isNotNull(agentsTable.computerId),
                isNull(agentsTable.retiredAt)
            )
        )
        .orderBy(agentsTable.createdAt);

    return rows.map((row) => toHostedAgent(row satisfies ConfiguredAgentRow));
}
