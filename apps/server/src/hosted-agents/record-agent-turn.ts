import type { HostedAgentTurnSummary } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable, agentTurnsTable } from '../postgres/schema.ts';

/**
 * Persists a Computer's compact turn summary. The `computer_id` guard means a
 * summary for an Agent not assigned to the reporting Computer writes nothing —
 * cross-Computer activity claims fail closed. The upsert is keyed by run so a
 * retried report never duplicates a turn row.
 */
export async function recordAgentTurnSummary(
    db: GrottoDatabase,
    computerId: string,
    summary: HostedAgentTurnSummary
): Promise<void> {
    const [agent] = await db
        .select({ serverId: agentsTable.serverId })
        .from(agentsTable)
        .where(and(eq(agentsTable.id, summary.agentId), eq(agentsTable.computerId, computerId)))
        .limit(1);
    if (!agent) {
        return;
    }

    await db
        .insert(agentTurnsTable)
        .values({
            agentId: summary.agentId,
            computerId,
            endedAt: new Date(summary.endedAt),
            failureKind: summary.failureKind ?? null,
            id: createOpaqueId('atn'),
            messageCount: summary.messageCount,
            outputProduced: summary.outputProduced,
            runId: summary.runId,
            serverId: agent.serverId,
            startedAt: new Date(summary.startedAt),
            status: summary.status,
            summary: summary.summary,
        })
        .onConflictDoUpdate({
            set: {
                endedAt: new Date(summary.endedAt),
                failureKind: summary.failureKind ?? null,
                messageCount: summary.messageCount,
                outputProduced: summary.outputProduced,
                reportedAt: new Date(),
                status: summary.status,
                summary: summary.summary,
            },
            target: [agentTurnsTable.serverId, agentTurnsTable.agentId, agentTurnsTable.runId],
        });
}
