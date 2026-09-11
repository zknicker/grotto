import {
    type AgentRecentTurn,
    type AgentRecentTurnsInput,
    agentRecentTurnsLimit,
} from '@grotto/api';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentTurnsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

const dayMs = 24 * 60 * 60 * 1000;

/**
 * Every turn any Agent on the Server started inside the window, newest first.
 *
 * This is the cross-Agent read: "who has been working lately" is a fact about
 * the Server, and answering it one Agent at a time is a fan-out the Server's
 * query pool cannot absorb. Server membership is the whole gate — a member
 * sees every Agent on the Server, so a per-Agent check would only repeat it.
 */
export async function listRecentAgentTurns(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: AgentRecentTurnsInput
): Promise<AgentRecentTurn[]> {
    await requireServerMembership(db, member, input.serverId);

    const since = new Date(Date.now() - input.days * dayMs);
    const rows = await db
        .select({
            agentId: agentTurnsTable.agentId,
            endedAt: agentTurnsTable.endedAt,
            runId: agentTurnsTable.runId,
            startedAt: agentTurnsTable.startedAt,
            status: agentTurnsTable.status,
        })
        .from(agentTurnsTable)
        .where(
            and(eq(agentTurnsTable.serverId, input.serverId), gte(agentTurnsTable.startedAt, since))
        )
        .orderBy(desc(agentTurnsTable.startedAt))
        .limit(agentRecentTurnsLimit);

    return rows.map((row) => ({
        ...row,
        endedAt: row.endedAt.toISOString(),
        startedAt: row.startedAt.toISOString(),
    }));
}
