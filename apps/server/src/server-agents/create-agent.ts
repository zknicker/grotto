import type { AgentCreated, AvatarMediaType, CreateAgentInput } from '@grotto/api';
import { type AvatarBytes, createAvatarId, readAvatarBytes } from '../avatars/avatar-bytes.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { violatesConstraint } from '../postgres/constraint-violation.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable, avatarsTable } from '../postgres/schema.ts';
import { participantHandleConstraint } from '../servers/participant-handles.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';
import { assertRuntimeModelReported, resolveAssignedComputer } from './agent-inventory.ts';
import { toAgent } from './agent-shape.ts';

/** Authorizes the ordinary and prepared Agent-creation boundaries. */
export async function requireAgentCreationAuthority(
    db: Pick<GrottoDatabase, 'select'>,
    member: GrottoUser | null,
    serverId: string
) {
    const server = await requireServerMembership(db, member, serverId);
    if (!member) {
        throw new AgentConfigDeniedError('Sign in to create an Agent.');
    }
    if (server.role !== 'owner' && server.role !== 'admin') {
        throw new AgentConfigDeniedError('Only a Server Owner or Admin can create an Agent.');
    }
    return server;
}

/** Creates one Agent; its per-human DMs remain implicit until first use. */
export async function createAgent(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: CreateAgentInput
): Promise<AgentCreated> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireAgentCreationAuthority(tx, member, input.serverId);
        const avatar = input.avatar
            ? {
                  ...readAvatarBytes(input.avatar.bytesBase64, input.avatar.mediaType),
                  mediaType: input.avatar.mediaType,
              }
            : null;
        return await createAgentInTransaction(tx, member, input, avatar);
    });
}

/** Shared write seam for ordinary creation and prepared-action commit. */
export async function createAgentInTransaction(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: CreateAgentInput,
    avatar: (AvatarBytes & { mediaType: AvatarMediaType }) | null
): Promise<AgentCreated> {
    if (!member) {
        throw new AgentConfigDeniedError('Sign in to create an Agent.');
    }

    const { health: computerHealth, inventory } = await resolveAssignedComputer(db, {
        computerId: input.computerId,
        serverId: input.serverId,
    });
    assertRuntimeModelReported(inventory, input.runtimeId, input.modelId);

    const avatarId = avatar ? createAvatarId() : null;
    if (avatar && avatarId) {
        await db.insert(avatarsTable).values({
            byteSize: avatar.bytes.byteLength,
            bytes: avatar.bytes,
            id: avatarId,
            mediaType: avatar.mediaType,
            sha256: avatar.sha256,
        });
    }

    const agentId = createOpaqueId('agt');
    try {
        await db.insert(agentsTable).values({
            avatarId,
            computerId: input.computerId,
            createdByUserId: member.id,
            description: input.description ?? null,
            desiredModelId: input.modelId,
            desiredReasoningEffort: input.reasoningEffort,
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

    return {
        agent: toAgent({
            activeRunId: null,
            avatarId,
            computerId: input.computerId,
            computerHealth,
            consecutiveFailures: 0,
            createdAt: new Date(),
            createdByUserId: member.id,
            description: input.description ?? null,
            desiredModelId: input.modelId,
            desiredReasoningEffort: input.reasoningEffort,
            desiredRuntimeId: input.runtimeId,
            displayName: input.displayName,
            dmChatId: null,
            effectiveGrottoAgentAppliedAt: null,
            effectiveGrottoAgentStatus: null,
            effectiveGrottoAgentVersion: null,
            effectiveMissing: null,
            effectiveModelId: null,
            effectiveReportedAt: null,
            effectiveRuntimeId: null,
            factoryKind: 'ordinary',
            handle: input.handle,
            id: agentId,
            role: input.role,
            serverId: input.serverId,
            stopped: false,
        }),
    };
}
