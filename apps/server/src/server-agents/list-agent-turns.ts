import type { AgentTurn, AgentTurnsInput } from '@tavern/api';
import { and, desc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentTurnsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireAgent } from './agent-delivery-control.ts';

/**
 * One Agent's settled turns, newest first. `outputProduced` is the field that
 * separates a silent turn from a lost one, so an observer can settle "did it
 * answer?" without reading Computer-local execution traces.
 */
export async function listAgentTurns(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: AgentTurnsInput
): Promise<AgentTurn[]> {
    await requireServerMembership(db, member, input.serverId);
    await requireAgent(db, input);

    const rows = await db
        .select({
            endedAt: agentTurnsTable.endedAt,
            failureKind: agentTurnsTable.failureKind,
            messageCount: agentTurnsTable.messageCount,
            outputProduced: agentTurnsTable.outputProduced,
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
        .orderBy(desc(agentTurnsTable.startedAt))
        .limit(input.limit);

    return rows.map((row) => ({
        ...row,
        agentId: input.agentId,
        endedAt: row.endedAt.toISOString(),
        startedAt: row.startedAt.toISOString(),
    }));
}
