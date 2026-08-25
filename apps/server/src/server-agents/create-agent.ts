import type { AgentCreated, CreateAgentInput } from '@grotto/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { violatesConstraint } from '../postgres/constraint-violation.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable } from '../postgres/schema.ts';
import { participantHandleConstraint } from '../servers/participant-handles.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';
import { assertRuntimeModelReported, resolveAssignedComputer } from './agent-inventory.ts';
import { toAgent } from './agent-shape.ts';

/**
 * Creates one Agent on exactly one attached Computer with a reported runtime
 * and model. Pairwise DMs remain implicit until their first durable message.
 */
export async function createAgent(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: CreateAgentInput
): Promise<AgentCreated> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const server = await requireServerMembership(tx, member, input.serverId);

        if (!member) {
            throw new AgentConfigDeniedError('Sign in to create an Agent.');
        }

        if (server.role !== 'owner' && server.role !== 'admin') {
            throw new AgentConfigDeniedError('Only a Server Owner or Admin can create an Agent.');
        }

        const { health: computerHealth, inventory } = await resolveAssignedComputer(tx, {
            computerId: input.computerId,
            serverId: input.serverId,
        });
        assertRuntimeModelReported(inventory, input.runtimeId, input.modelId);

        const agentId = createOpaqueId('agt');

        try {
            await tx.insert(agentsTable).values({
                computerId: input.computerId,
                createdByUserId: member?.id ?? null,
                description: input.description ?? null,
                desiredModelId: input.modelId,
                desiredRuntimeId: input.runtimeId,
                displayName: input.displayName,
                handle: input.handle,
                homeTimezone: 'UTC',
                id: agentId,
                role: input.role,
                serverId: input.serverId,
            });
        } catch (cause) {
            if (
                violatesConstraint(cause, 'agents_server_handle_key') ||
                violatesConstraint(cause, participantHandleConstraint)
            ) {
                throw new AgentConfigDeniedError(`The handle "${input.handle}" is already taken.`);
            }
            throw cause;
        }

        const agentRow = {
            activeRunId: null,
            avatarId: null,
            computerId: input.computerId,
            computerHealth,
            consecutiveFailures: 0,
            createdAt: new Date(),
            description: input.description ?? null,
            desiredModelId: input.modelId,
            desiredRuntimeId: input.runtimeId,
            displayName: input.displayName,
            dmChatId: null,
            effectiveMissing: null,
            effectiveModelId: null,
            effectiveReportedAt: null,
            effectiveRuntimeId: null,
            factoryKind: 'ordinary' as const,
            createdByUserId: member.id,
            handle: input.handle,
            id: agentId,
            role: input.role,
            serverId: input.serverId,
            stopped: false,
        };

        return { agent: toAgent(agentRow) };
    });
}
