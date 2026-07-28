import type { HostedAgentActivityEntry } from '@tavern/api';
import { and, desc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentTurnsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function listHostedAgentActivity(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { agentId: string; limit: number; serverId: string }
): Promise<HostedAgentActivityEntry[]> {
    await requireServerMembership(db, member, input.serverId);
    const rows = await db
        .select({
            endedAt: agentTurnsTable.endedAt,
            messageCount: agentTurnsTable.messageCount,
            runId: agentTurnsTable.runId,
            startedAt: agentTurnsTable.startedAt,
            status: agentTurnsTable.status,
            summary: agentTurnsTable.summary,
        })
        .from(agentTurnsTable)
        .where(
            and(
                eq(agentTurnsTable.serverId, input.serverId),
                eq(agentTurnsTable.agentId, input.agentId)
            )
        )
        .orderBy(desc(agentTurnsTable.endedAt))
        .limit(input.limit);

    return rows.map((row) => ({
        ...row,
        endedAt: row.endedAt.toISOString(),
        startedAt: row.startedAt.toISOString(),
    }));
}
