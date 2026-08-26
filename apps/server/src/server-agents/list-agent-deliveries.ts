import type { AgentDeliveriesInput, AgentDeliveryRecord } from '@grotto/api';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentPendingWorkTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireAgent } from './agent-delivery-control.ts';

/**
 * One Agent's delivery ledger, newest first. Rows settled as `seen` are kept
 * with the turn that consumed them, so "never delivered" and "delivered and
 * answered with silence" read differently here.
 */
export async function listAgentDeliveries(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: AgentDeliveriesInput
): Promise<AgentDeliveryRecord[]> {
    await requireServerMembership(db, member, input.serverId);
    await requireAgent(db, input);

    const rows = await db
        .select({
            acceptedAt: agentPendingWorkTable.acceptedAt,
            actionId: sql<
                string | null
            >`case when ${agentPendingWorkTable.source} = 'action' then ${agentPendingWorkTable.dedupeKey} else null end`,
            chatId: agentPendingWorkTable.chatId,
            createdAt: agentPendingWorkTable.createdAt,
            messageId: sql<
                string | null
            >`case when ${agentPendingWorkTable.source} = 'action' then null else ${agentPendingWorkTable.dedupeKey} end`,
            source: agentPendingWorkTable.source,
            seenAt: agentPendingWorkTable.seenAt,
            servedAt: agentPendingWorkTable.servedAt,
            state: agentPendingWorkTable.state,
            turnId: agentPendingWorkTable.settledRunId,
            workId: agentPendingWorkTable.dedupeKey,
        })
        .from(agentPendingWorkTable)
        .where(
            and(
                eq(agentPendingWorkTable.serverId, input.serverId),
                eq(agentPendingWorkTable.agentId, input.agentId)
            )
        )
        .orderBy(desc(agentPendingWorkTable.createdAt))
        .limit(input.limit);

    return rows.map((row) => ({
        ...row,
        acceptedAt: row.acceptedAt?.toISOString() ?? null,
        agentId: input.agentId,
        createdAt: row.createdAt.toISOString(),
        seenAt: row.seenAt?.toISOString() ?? null,
        servedAt: row.servedAt?.toISOString() ?? null,
    }));
}
