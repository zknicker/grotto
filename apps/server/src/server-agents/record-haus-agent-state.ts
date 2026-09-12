import type { HausAgentAppliedState } from '@haus/api';
import { and, eq } from 'drizzle-orm';
import type { HausDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';

export async function clearHausAgentState(db: HausDatabase, computerId: string): Promise<void> {
    await db
        .update(agentsTable)
        .set({
            effectiveHausAgentAppliedAt: null,
            effectiveHausAgentStatus: null,
            effectiveHausAgentVersion: null,
        })
        .where(eq(agentsTable.computerId, computerId));
}

/** Applies one Computer's complete Haus Agent version snapshot to its assigned Agents. */
export async function recordHausAgentState(
    db: HausDatabase,
    computerId: string,
    states: HausAgentAppliedState[]
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .update(agentsTable)
            .set({
                effectiveHausAgentAppliedAt: null,
                effectiveHausAgentStatus: null,
                effectiveHausAgentVersion: null,
            })
            .where(eq(agentsTable.computerId, computerId));

        for (const state of states) {
            await tx
                .update(agentsTable)
                .set({
                    effectiveHausAgentAppliedAt: state.appliedAt ? new Date(state.appliedAt) : null,
                    effectiveHausAgentStatus: state.status,
                    effectiveHausAgentVersion: state.version,
                })
                .where(
                    and(eq(agentsTable.id, state.agentId), eq(agentsTable.computerId, computerId))
                );
        }
    });
}
