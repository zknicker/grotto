import type { HostedDeleteAgentInput } from '@tavern/api';
import { and, eq, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentDeliveryTable,
    agentMcpToolGrantsTable,
    agentPendingWorkTable,
    agentRunnerCredentialsTable,
    agentsTable,
    channelAgentParticipantsTable,
    reminderAgentAttentionTable,
    remindersTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentDeleteDeniedError } from './agent-config-errors.ts';

/** Retires an Agent in the Server transaction; local Computer cleanup is never a prerequisite. */
export async function deleteHostedAgent(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedDeleteAgentInput
): Promise<{ agentId: string }> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const server = await requireServerMembership(tx, member, input.serverId);
        if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
            throw new AgentDeleteDeniedError('Only a Server Owner or Admin can delete an Agent.');
        }
        const [agent] = await tx
            .select({ displayName: agentsTable.displayName, id: agentsTable.id })
            .from(agentsTable)
            .where(
                and(
                    eq(agentsTable.serverId, input.serverId),
                    eq(agentsTable.id, input.agentId),
                    isNull(agentsTable.retiredAt)
                )
            )
            .for('update');
        if (!agent) {
            throw new AgentDeleteDeniedError('That Agent no longer exists.');
        }
        if (input.confirmation !== agent.displayName) {
            throw new AgentDeleteDeniedError('Type the Agent name exactly to delete it.');
        }

        const owner = and(
            eq(agentDeliveryTable.serverId, input.serverId),
            eq(agentDeliveryTable.agentId, agent.id)
        );
        await tx.delete(agentRunnerCredentialsTable).where(
            and(
                eq(agentRunnerCredentialsTable.serverId, input.serverId),
                eq(agentRunnerCredentialsTable.agentId, agent.id)
            )
        );
        await tx.delete(agentPendingWorkTable).where(
            and(
                eq(agentPendingWorkTable.serverId, input.serverId),
                eq(agentPendingWorkTable.agentId, agent.id)
            )
        );
        await tx.delete(reminderAgentAttentionTable).where(
            and(
                eq(reminderAgentAttentionTable.serverId, input.serverId),
                eq(reminderAgentAttentionTable.agentId, agent.id)
            )
        );
        await tx
            .update(remindersTable)
            .set({ status: 'canceled', updatedAt: new Date() })
            .where(
                and(
                    eq(remindersTable.serverId, input.serverId),
                    eq(remindersTable.ownerAgentId, agent.id),
                    eq(remindersTable.status, 'scheduled')
                )
            );
        await tx.delete(channelAgentParticipantsTable).where(
            and(
                eq(channelAgentParticipantsTable.serverId, input.serverId),
                eq(channelAgentParticipantsTable.agentId, agent.id)
            )
        );
        await tx.delete(agentMcpToolGrantsTable).where(
            and(
                eq(agentMcpToolGrantsTable.serverId, input.serverId),
                eq(agentMcpToolGrantsTable.agentId, agent.id)
            )
        );
        await tx.delete(agentDeliveryTable).where(owner);
        await tx
            .update(agentsTable)
            .set({
                computerId: null,
                desiredModelId: null,
                desiredRuntimeId: null,
                effectiveMissing: null,
                effectiveModelId: null,
                effectiveReportedAt: null,
                effectiveRuntimeId: null,
                retiredAt: new Date(),
            })
            .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, agent.id)));
        return { agentId: agent.id };
    });
}
