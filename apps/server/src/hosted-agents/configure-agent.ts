import type { HostedAgent, HostedConfigureAgentInput } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentDeliveryTable, agentsTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';
import { assertRuntimeModelReported, resolveAssignedComputer } from './agent-inventory.ts';
import { type ConfiguredAgentRow, toHostedAgent } from './agent-shape.ts';

/**
 * Changes an Agent's desired runtime/model on its existing Computer. The
 * Computer assignment is immutable and absent from the input, and the new pair
 * is validated only against that same Computer's last-reported inventory — so
 * an offline Computer's saved config still fails closed on a cross-Computer or
 * unreported reference.
 */
export async function configureHostedAgent(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedConfigureAgentInput
): Promise<HostedAgent> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const server = await requireServerMembership(tx, member, input.serverId);

        if (!member) {
            throw new AgentConfigDeniedError('Sign in to configure an Agent.');
        }

        if (server.role !== 'owner' && server.role !== 'admin') {
            throw new AgentConfigDeniedError(
                'Only a Server Owner or Admin can configure an Agent.'
            );
        }

        const [agent] = await tx
            .select({ computerId: agentsTable.computerId })
            .from(agentsTable)
            .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
            .limit(1);

        if (!agent?.computerId) {
            throw new AgentConfigDeniedError('No configured Agent exists with that id.');
        }

        const { health: computerHealth, inventory } = await resolveAssignedComputer(tx, {
            computerId: agent.computerId,
            serverId: input.serverId,
        });
        assertRuntimeModelReported(inventory, input.runtimeId, input.modelId);

        await tx
            .update(agentsTable)
            .set({ desiredModelId: input.modelId, desiredRuntimeId: input.runtimeId })
            .where(
                and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId))
            );

        const agentDm = alias(chatsTable, 'agent_dm');
        const [row] = await tx
            .select({
                activeRunId: agentDeliveryTable.activeRunId,
                computerId: agentsTable.computerId,
                consecutiveFailures: agentDeliveryTable.consecutiveFailures,
                createdAt: agentsTable.createdAt,
                description: agentsTable.description,
                desiredModelId: agentsTable.desiredModelId,
                desiredRuntimeId: agentsTable.desiredRuntimeId,
                displayName: agentsTable.displayName,
                dmChatId: agentDm.id,
                effectiveMissing: agentsTable.effectiveMissing,
                effectiveModelId: agentsTable.effectiveModelId,
                effectiveReportedAt: agentsTable.effectiveReportedAt,
                effectiveRuntimeId: agentsTable.effectiveRuntimeId,
                handle: agentsTable.handle,
                id: agentsTable.id,
                role: agentsTable.role,
                serverId: agentsTable.serverId,
                stopped: agentDeliveryTable.stopped,
            })
            .from(agentsTable)
            .leftJoin(
                agentDm,
                and(
                    eq(agentDm.serverId, agentsTable.serverId),
                    eq(agentDm.dmAgentId, agentsTable.id),
                    eq(agentDm.dmMemberOneUserId, member.id),
                    eq(agentDm.kind, 'dm')
                )
            )
            .leftJoin(agentDeliveryTable, eq(agentDeliveryTable.agentId, agentsTable.id))
            .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
            .limit(1);

        if (!row) {
            throw new AgentConfigDeniedError('No configured Agent exists with that id.');
        }

        return toHostedAgent({
            ...row,
            activeRunId: row.activeRunId ?? null,
            computerHealth,
            consecutiveFailures: row.consecutiveFailures ?? 0,
            stopped: row.stopped ?? false,
        } satisfies ConfiguredAgentRow);
    });
}
