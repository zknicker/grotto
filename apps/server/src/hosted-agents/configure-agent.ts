import type { HostedAgent, HostedConfigureAgentInput, HostedDurableEvent } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { recordHostedSessionRotationReceipts } from '../agent-delivery/session-rotation.ts';
import * as deliveryStore from '../agent-delivery/store.ts';
import { revokeRunnerCredentialsForRun } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentDeliveryTable,
    agentMessageDraftsTable,
    agentsTable,
    chatsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';
import { assertRuntimeModelReported, resolveAssignedComputer } from './agent-inventory.ts';
import { type ConfiguredAgentRow, toHostedAgent } from './agent-shape.ts';

export interface HostedAgentConfigurationRotation {
    chatId: string | null;
    computerId: string;
    events: HostedDurableEvent[];
    runId: string | null;
    sessionGeneration: number;
}

export interface ConfigureHostedAgentResult {
    agent: HostedAgent;
    rotation: HostedAgentConfigurationRotation | null;
}

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
): Promise<ConfigureHostedAgentResult> {
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
            .select({
                computerId: agentsTable.computerId,
                createdByUserId: agentsTable.createdByUserId,
                desiredModelId: agentsTable.desiredModelId,
                desiredRuntimeId: agentsTable.desiredRuntimeId,
            })
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

        const changed =
            agent.desiredRuntimeId !== input.runtimeId || agent.desiredModelId !== input.modelId;
        const delivery = changed ? await deliveryStore.readDeliveryState(tx, input.agentId) : null;
        if (changed && delivery?.activeRunId) {
            await revokeRunnerCredentialsForRun(tx, {
                agentId: input.agentId,
                runId: delivery.activeRunId,
                serverId: input.serverId,
            });
            await deliveryStore.requeuePendingForRun(tx, {
                agentId: input.agentId,
                runId: delivery.activeRunId,
            });
            await deliveryStore.clearActiveRun(tx, input.agentId);
        }

        const [configured] = await tx
            .update(agentsTable)
            .set({
                desiredModelId: input.modelId,
                desiredRuntimeId: input.runtimeId,
                ...(changed
                    ? {
                          sessionGeneration: sql`${agentsTable.sessionGeneration} + 1`,
                          sessionResetKind: 'session' as const,
                      }
                    : {}),
            })
            .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
            .returning({ sessionGeneration: agentsTable.sessionGeneration });
        if (!configured) {
            throw new AgentConfigDeniedError('No configured Agent exists with that id.');
        }

        let rotation: HostedAgentConfigurationRotation | null = null;
        if (changed) {
            await tx
                .delete(agentMessageDraftsTable)
                .where(eq(agentMessageDraftsTable.agentId, input.agentId));
            rotation = {
                chatId: delivery?.activeRunChatId ?? null,
                computerId: agent.computerId,
                events: await recordHostedSessionRotationReceipts(tx, {
                    agentId: input.agentId,
                    generation: configured.sessionGeneration,
                    reason: 'configuration',
                    serverId: input.serverId,
                }),
                runId: delivery?.activeRunId ?? null,
                sessionGeneration: configured.sessionGeneration,
            };
        }

        const agentDm = alias(chatsTable, 'agent_dm');
        const [row] = await tx
            .select({
                activeRunId: agentDeliveryTable.activeRunId,
                archetype: agentsTable.archetype,
                avatarId: agentsTable.avatarId,
                computerId: agentsTable.computerId,
                createdByUserId: agentsTable.createdByUserId,
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

        return {
            agent: toHostedAgent({
                ...row,
                activeRunId: row.activeRunId ?? null,
                computerHealth,
                createdByUserId: row.createdByUserId ?? null,
                consecutiveFailures: row.consecutiveFailures ?? 0,
                stopped: row.stopped ?? false,
            } satisfies ConfiguredAgentRow),
            rotation,
        };
    });
}
