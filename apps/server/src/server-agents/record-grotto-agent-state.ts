import type { GrottoAgentAppliedState } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';

export async function clearGrottoAgentState(db: GrottoDatabase, computerId: string): Promise<void> {
    await db
        .update(agentsTable)
        .set({
            effectiveGrottoAgentAppliedAt: null,
            effectiveGrottoAgentStatus: null,
            effectiveGrottoAgentVersion: null,
        })
        .where(eq(agentsTable.computerId, computerId));
}

/** Applies one Computer's complete Grotto Agent version snapshot to its assigned Agents. */
export async function recordGrottoAgentState(
    db: GrottoDatabase,
    computerId: string,
    states: GrottoAgentAppliedState[]
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .update(agentsTable)
            .set({
                effectiveGrottoAgentAppliedAt: null,
                effectiveGrottoAgentStatus: null,
                effectiveGrottoAgentVersion: null,
            })
            .where(eq(agentsTable.computerId, computerId));

        for (const state of states) {
            await tx
                .update(agentsTable)
                .set({
                    effectiveGrottoAgentAppliedAt: state.appliedAt
                        ? new Date(state.appliedAt)
                        : null,
                    effectiveGrottoAgentStatus: state.status,
                    effectiveGrottoAgentVersion: state.version,
                })
                .where(
                    and(eq(agentsTable.id, state.agentId), eq(agentsTable.computerId, computerId))
                );
        }
    });
}
