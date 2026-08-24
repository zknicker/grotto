import type { AgentCreated, CreateAgentInput } from '@tavern/api';
import { and, eq, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { violatesConstraint } from '../postgres/constraint-violation.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable, chatsTable, serverMembershipsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';
import { assertRuntimeModelReported, resolveAssignedComputer } from './agent-inventory.ts';
import { toAgent } from './agent-shape.ts';

/**
 * Creates one Agent on exactly one attached Computer with a reported runtime
 * and model, then opens the ordinary Owner↔Agent DM. There is no onboarding
 * Channel — the first Agent starts in the same DM shape as any other.
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

        const [standing] = await tx
            .select({ stint: serverMembershipsTable.stint })
            .from(serverMembershipsTable)
            .where(
                and(
                    eq(serverMembershipsTable.serverId, input.serverId),
                    eq(serverMembershipsTable.userId, member.id),
                    isNull(serverMembershipsTable.revokedAt)
                )
            )
            .limit(1);

        if (!standing) {
            throw new AgentConfigDeniedError('You are not a current member of this Server.');
        }

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
            if (violatesConstraint(cause, 'agents_server_handle_key')) {
                throw new AgentConfigDeniedError(`The handle "${input.handle}" is already taken.`);
            }
            throw cause;
        }

        const chatId = createOpaqueId('cht');
        const [chatRow] = await tx
            .insert(chatsTable)
            .values({
                dmAgentId: agentId,
                dmMemberOneStint: standing.stint,
                dmMemberOneUserId: member.id,
                id: chatId,
                kind: 'dm',
                serverId: input.serverId,
            })
            .returning({ createdAt: chatsTable.createdAt });

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
            dmChatId: chatId,
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

        return {
            agent: toAgent(agentRow),
            chat: {
                archivedAt: null,
                archivedByUserId: null,
                color: null,
                createdAt: (chatRow?.createdAt ?? new Date()).toISOString(),
                icon: null,
                id: chatId,
                isAll: false,
                kind: 'dm' as const,
                lastActivityAt: null,
                lastMessageSequence: 0,
                name: null,
                participantAgentIds: [agentId],
                participantUserIds: [member.id],
                peerAgentDisplayName: input.displayName,
                peerAgentId: agentId,
                peerAgentRetired: false,
                peerUserId: null,
                serverId: input.serverId,
                unreadCount: 0,
            },
        };
    });
}
