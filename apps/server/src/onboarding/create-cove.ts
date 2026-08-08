import { createHash } from 'node:crypto';
import type { HostedAgent, HostedCoveApplyCommand, HostedCoveApplyResult } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import coveAvatarPath from '../../../website/public/prototypes/cove-avatar.png' with {
    type: 'file',
};
import { enqueuePendingWork } from '../agent-delivery/store.ts';
import { createAvatarId } from '../avatars/avatar-bytes.ts';
import type { ComputerConnections } from '../computers/connections.ts';
import {
    assertRuntimeModelReported,
    resolveAssignedComputer,
} from '../hosted-agents/agent-inventory.ts';
import { queryHostedAgents } from '../hosted-agents/query-agents.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentDeliveryTable,
    agentsTable,
    avatarsTable,
    channelAgentParticipantsTable,
    serverOnboardingTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export interface CreateCoveInput {
    computerId: string;
    modelId: string;
    runtimeId: string;
    serverId: string;
}

export interface CreateCoveResult {
    agent: HostedAgent;
    applicationId: string;
    channelId: string;
    phase: 'applying' | 'complete';
}

export class CoveSetupError extends Error {}
export class CoveSetupConflictError extends CoveSetupError {}

export async function createCove(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: CreateCoveInput
): Promise<CreateCoveResult> {
    const reservation = await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const server = await requireServerMembership(tx, member, input.serverId);
        if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
            throw new CoveSetupError('Only a Server Owner or Admin can create Cove.');
        }
        const [onboarding] = await tx
            .select()
            .from(serverOnboardingTable)
            .where(eq(serverOnboardingTable.serverId, input.serverId))
            .limit(1);
        if (!onboarding) {
            throw new CoveSetupError('This Server has no fresh onboarding state.');
        }
        if (onboarding.agentId && onboarding.applicationId) {
            assertSameConfiguration(onboarding, input);
            return {
                agentId: onboarding.agentId,
                applicationId: onboarding.applicationId,
                channelId: onboarding.channelId,
                phase:
                    onboarding.phase === 'complete' ? ('complete' as const) : ('applying' as const),
            };
        }
        if (onboarding.phase !== 'awaiting-cove' || onboarding.computerId !== input.computerId) {
            throw new CoveSetupError('Cove setup is not ready for that Computer.');
        }
        const { health, inventory } = await resolveAssignedComputer(tx, input);
        if (health !== 'healthy') {
            throw new CoveSetupError('The selected Computer must be online and healthy.');
        }
        assertRuntimeModelReported(inventory, input.runtimeId, input.modelId);

        const avatar = await coveAvatarRow();
        const agentId = createOpaqueId('agt');
        const applicationId = createOpaqueId('cap');
        await tx.insert(avatarsTable).values(avatar);
        await tx.insert(agentsTable).values({
            avatarId: avatar.id,
            computerId: input.computerId,
            createdByUserId: member.id,
            description: 'Onboarding Assistant',
            desiredModelId: input.modelId,
            desiredRuntimeId: input.runtimeId,
            displayName: 'Cove',
            factoryKind: 'cove',
            handle: 'cove',
            homeTimezone: 'UTC',
            id: agentId,
            role: 'admin',
            serverId: input.serverId,
        });
        await tx.insert(agentDeliveryTable).values({ agentId, serverId: input.serverId });
        await tx.insert(channelAgentParticipantsTable).values({
            agentId,
            chatId: onboarding.channelId,
            serverId: input.serverId,
        });
        await tx
            .update(serverOnboardingTable)
            .set({
                agentId,
                applicationId,
                failureCode: null,
                failureDetail: null,
                modelId: input.modelId,
                phase: 'applying',
                runtimeId: input.runtimeId,
                updatedAt: new Date(),
            })
            .where(eq(serverOnboardingTable.serverId, input.serverId));
        return {
            agentId,
            applicationId,
            channelId: onboarding.channelId,
            phase: 'applying' as const,
        };
    });

    const [agent] = await queryHostedAgents(db, member, input.serverId, reservation.agentId);
    if (!agent) {
        throw new CoveSetupError('Cove was reserved but could not be read.');
    }
    return { agent, ...reservation };
}

export async function readPendingCoveCommand(
    db: GrottoDatabase,
    computerId: string
): Promise<HostedCoveApplyCommand | null> {
    const [row] = await db
        .select({
            agentDescription: agentsTable.description,
            agentId: agentsTable.id,
            agentName: agentsTable.displayName,
            applicationId: serverOnboardingTable.applicationId,
            modelId: serverOnboardingTable.modelId,
            runtimeId: serverOnboardingTable.runtimeId,
            sessionGeneration: agentsTable.sessionGeneration,
        })
        .from(serverOnboardingTable)
        .innerJoin(agentsTable, eq(agentsTable.id, serverOnboardingTable.agentId))
        .where(
            and(
                eq(serverOnboardingTable.computerId, computerId),
                eq(serverOnboardingTable.phase, 'applying')
            )
        )
        .limit(1);
    if (!(row?.applicationId && row.modelId && row.runtimeId)) {
        return null;
    }
    return {
        agentDescription: 'Onboarding Assistant',
        agentId: row.agentId,
        agentName: 'Cove',
        applicationId: row.applicationId,
        factoryKind: 'cove',
        modelId: row.modelId,
        runtimeId: row.runtimeId,
        sessionGeneration: row.sessionGeneration,
        type: 'cove-apply',
    };
}

export async function sendPendingCoveApplication(
    db: GrottoDatabase,
    connections: ComputerConnections,
    computerId: string
): Promise<boolean> {
    const command = await readPendingCoveCommand(db, computerId);
    return command ? connections.send(computerId, command) : false;
}

export async function recordCoveApplyResult(
    db: GrottoDatabase,
    computerId: string,
    result: HostedCoveApplyResult
): Promise<string | null> {
    const [candidate] = await db
        .select({ serverId: serverOnboardingTable.serverId })
        .from(serverOnboardingTable)
        .where(
            and(
                eq(serverOnboardingTable.computerId, computerId),
                eq(serverOnboardingTable.agentId, result.agentId),
                eq(serverOnboardingTable.applicationId, result.applicationId)
            )
        )
        .limit(1);
    if (!candidate) {
        return null;
    }
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, candidate.serverId);
        const [row] = await tx
            .select()
            .from(serverOnboardingTable)
            .where(
                and(
                    eq(serverOnboardingTable.computerId, computerId),
                    eq(serverOnboardingTable.agentId, result.agentId),
                    eq(serverOnboardingTable.applicationId, result.applicationId)
                )
            )
            .limit(1);
        if (!row) {
            return null;
        }
        if (result.status === 'applied') {
            if (row.phase !== 'complete') {
                await tx
                    .update(agentsTable)
                    .set({ factoryAppliedAt: new Date() })
                    .where(eq(agentsTable.id, result.agentId));
                await enqueuePendingWork(tx, {
                    agentId: result.agentId,
                    chatId: row.channelId,
                    content:
                        'Greet the owner in this onboarding Channel. Introduce yourself as Cove and help them begin real work in Grotto.',
                    dedupeKey: result.applicationId,
                    serverId: row.serverId,
                    source: 'onboarding',
                });
                await tx
                    .update(serverOnboardingTable)
                    .set({
                        failureCode: null,
                        failureDetail: null,
                        phase: 'complete',
                        updatedAt: new Date(),
                    })
                    .where(eq(serverOnboardingTable.serverId, row.serverId));
            }
        } else if (row.phase !== 'complete') {
            await tx
                .update(serverOnboardingTable)
                .set({
                    failureCode: 'application-failed',
                    failureDetail: result.error,
                    updatedAt: new Date(),
                })
                .where(eq(serverOnboardingTable.serverId, row.serverId));
        }
        return row.serverId;
    });
}

function assertSameConfiguration(
    existing: { computerId: string | null; modelId: string | null; runtimeId: string | null },
    input: CreateCoveInput
) {
    if (
        existing.computerId !== input.computerId ||
        existing.runtimeId !== input.runtimeId ||
        existing.modelId !== input.modelId
    ) {
        throw new CoveSetupConflictError(
            'Cove configuration is already locked and cannot be rebound.'
        );
    }
}

async function coveAvatarRow() {
    const bytes = new Uint8Array(await Bun.file(coveAvatarPath).arrayBuffer());
    return {
        byteSize: bytes.byteLength,
        bytes,
        id: createAvatarId(),
        mediaType: 'image/png' as const,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    };
}
