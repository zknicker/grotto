import type { AgentEffectiveState } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';

/**
 * Applies a Computer's per-Agent effective snapshot. The `computer_id` guard
 * means a report for an Agent that is not assigned to the reporting Computer
 * updates no row — cross-Computer effective claims fail closed.
 */
export async function recordAgentEffectiveState(
    db: GrottoDatabase,
    computerId: string,
    states: AgentEffectiveState[]
): Promise<void> {
    const reportedAt = new Date();

    for (const state of states) {
        await db
            .update(agentsTable)
            .set({
                effectiveMissing: state.missingResources,
                effectiveModelId: state.modelId,
                effectiveReasoningEffort: state.reasoningEffort,
                effectiveReportedAt: reportedAt,
                effectiveRuntimeId: state.runtimeId,
            })
            .where(and(eq(agentsTable.id, state.agentId), eq(agentsTable.computerId, computerId)));
    }
}
