import type { AgentAvatarGenerationInput } from '@grotto/api';
import { and, eq, isNull } from 'drizzle-orm';
import { AvatarDeniedError, AvatarOwnerNotFoundError } from '../avatars/avatar-errors.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { AvatarImageService } from './service.ts';

/** Authorizes and generates one transient preview for an editable Agent. */
export async function generateAgentAvatar(
    db: GrottoDatabase,
    member: GrottoUser | null,
    avatarImageService: AvatarImageService,
    input: AgentAvatarGenerationInput
) {
    const server = await requireServerMembership(db, member, input.serverId);

    if (!member) {
        throw new AvatarDeniedError('Sign in to generate an avatar.');
    }

    if (server.role !== 'owner' && server.role !== 'admin') {
        throw new AvatarDeniedError("Only a Server Owner or Admin can generate an Agent's avatar.");
    }

    const [agent] = await db
        .select({ factoryKind: agentsTable.factoryKind })
        .from(agentsTable)
        .where(
            and(
                eq(agentsTable.id, input.agentId),
                eq(agentsTable.serverId, input.serverId),
                isNull(agentsTable.retiredAt)
            )
        )
        .limit(1);

    if (!agent) {
        throw new AvatarOwnerNotFoundError('No active Agent exists with that id.');
    }

    if (agent.factoryKind === 'cove') {
        throw new AvatarDeniedError("Cove's product-owned avatar cannot be changed.");
    }

    return await avatarImageService.generate(input);
}
