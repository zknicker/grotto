import type { AgentDeliveriesInput, AgentDeliveryRecord } from '@grotto/api';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentInboxTable } from '../postgres/schema.ts';
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
            acceptedAt: agentInboxTable.acceptedAt,
            actionId: sql<
                string | null
            >`case when ${agentInboxTable.source} = 'action' then ${agentInboxTable.dedupeKey} else null end`,
            chatId: agentInboxTable.chatId,
            createdAt: agentInboxTable.createdAt,
            messageId: sql<
                string | null
            >`case when ${agentInboxTable.source} = 'action' then null else ${agentInboxTable.dedupeKey} end`,
            source: agentInboxTable.source,
            seenAt: agentInboxTable.seenAt,
            servedAt: agentInboxTable.servedAt,
            state: agentInboxTable.state,
            turnId: agentInboxTable.settledRunId,
            workId: agentInboxTable.dedupeKey,
        })
        .from(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.serverId, input.serverId),
                eq(agentInboxTable.agentId, input.agentId)
            )
        )
        .orderBy(desc(agentInboxTable.createdAt))
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
