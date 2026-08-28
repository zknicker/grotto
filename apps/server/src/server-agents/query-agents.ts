import type { Agent } from '@grotto/api';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentDeliveryTable, agentsTable, chatsTable, computersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { type ConfiguredAgentRow, toAgent } from './agent-shape.ts';

export async function queryAgents(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string,
    agentId?: string
): Promise<Agent[]> {
    await requireServerMembership(db, member, serverId);

    if (!member) {
        return [];
    }

    const agentDm = alias(chatsTable, 'agent_dm');
    const rows = await db
        .select({
            activeRunId: agentDeliveryTable.activeRunId,
            avatarId: agentsTable.avatarId,
            computerId: agentsTable.computerId,
            createdByUserId: agentsTable.createdByUserId,
            computerHealth: computersTable.health,
            consecutiveFailures: agentDeliveryTable.consecutiveFailures,
            createdAt: agentsTable.createdAt,
            description: agentsTable.description,
            desiredModelId: agentsTable.desiredModelId,
            desiredReasoningEffort: agentsTable.desiredReasoningEffort,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            displayName: agentsTable.displayName,
            dmChatId: agentDm.id,
            effectiveGrottoAgentAppliedAt: agentsTable.effectiveGrottoAgentAppliedAt,
            effectiveGrottoAgentStatus: agentsTable.effectiveGrottoAgentStatus,
            effectiveGrottoAgentVersion: agentsTable.effectiveGrottoAgentVersion,
            effectiveMissing: agentsTable.effectiveMissing,
            effectiveModelId: agentsTable.effectiveModelId,
            effectiveReportedAt: agentsTable.effectiveReportedAt,
            effectiveRuntimeId: agentsTable.effectiveRuntimeId,
            factoryKind: agentsTable.factoryKind,
            handle: agentsTable.handle,
            id: agentsTable.id,
            role: agentsTable.role,
            serverId: agentsTable.serverId,
            stopped: agentDeliveryTable.stopped,
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
        .innerJoin(
            computersTable,
            and(
                eq(computersTable.serverId, agentsTable.serverId),
                eq(computersTable.id, agentsTable.computerId)
            )
        )
        .leftJoin(agentDeliveryTable, eq(agentDeliveryTable.agentId, agentsTable.id))
        .where(
            and(
                eq(agentsTable.serverId, serverId),
                agentId ? eq(agentsTable.id, agentId) : undefined,
                isNotNull(agentsTable.computerId),
                isNull(agentsTable.retiredAt)
            )
        )
        .orderBy(agentsTable.createdAt);

    return rows.map((row) =>
        toAgent({
            ...row,
            activeRunId: row.activeRunId ?? null,
            consecutiveFailures: row.consecutiveFailures ?? 0,
            stopped: row.stopped ?? false,
        } satisfies ConfiguredAgentRow)
    );
}
