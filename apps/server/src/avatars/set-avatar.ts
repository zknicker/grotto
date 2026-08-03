import type {
    HostedAvatar,
    HostedAvatarTarget,
    HostedClearAvatarInput,
    HostedSetAvatarInput,
} from '@tavern/api';
import { and, eq, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, avatarsTable, usersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { createAvatarId, readAvatarBytes } from './avatar-bytes.ts';
import { AvatarDeniedError, AvatarOwnerNotFoundError } from './avatar-errors.ts';
import { avatarUrlFor } from './avatar-url.ts';

type AvatarWriter = Pick<GrottoDatabase, 'delete' | 'select' | 'update'>;

/**
 * Replaces the avatar an Agent or the signed-in human wears. The previous row
 * is dropped in the same transaction, so an avatar only ever exists while
 * something points at it.
 */
export async function setHostedAvatar(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedSetAvatarInput
): Promise<HostedAvatar> {
    const { bytes, sha256 } = readAvatarBytes(input.bytesBase64, input.mediaType);

    return await db.transaction(async (tx) => {
        const owner = await authorizeAvatarWrite(tx, member, input.serverId, input.target);
        const avatarId = createAvatarId();

        await tx.insert(avatarsTable).values({
            byteSize: bytes.byteLength,
            bytes,
            id: avatarId,
            mediaType: input.mediaType,
            sha256,
        });
        await assignAvatar(tx, owner, avatarId);

        return { avatarId, avatarUrl: avatarUrlFor(avatarId) };
    });
}

/** Drops the avatar entirely; surfaces fall back to initials. */
export async function clearHostedAvatar(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedClearAvatarInput
): Promise<HostedAvatar> {
    return await db.transaction(async (tx) => {
        const owner = await authorizeAvatarWrite(tx, member, input.serverId, input.target);
        await assignAvatar(tx, owner, null);

        return { avatarId: null, avatarUrl: null };
    });
}

interface AvatarOwner {
    id: string;
    kind: HostedAvatarTarget['kind'];
    serverId: string;
}

async function authorizeAvatarWrite(
    tx: AvatarWriter & Pick<GrottoDatabase, 'execute'>,
    member: GrottoUser | null,
    serverId: string,
    target: HostedAvatarTarget
): Promise<AvatarOwner> {
    await lockServerRow(tx, serverId);
    const server = await requireServerMembership(tx, member, serverId);

    if (!member) {
        throw new AvatarDeniedError('Sign in to change an avatar.');
    }

    if (target.kind === 'user') {
        return { id: member.id, kind: 'user', serverId };
    }

    if (server.role !== 'owner' && server.role !== 'admin') {
        throw new AvatarDeniedError("Only a Server Owner or Admin can change an Agent's avatar.");
    }

    return { id: target.agentId, kind: 'agent', serverId };
}

async function assignAvatar(tx: AvatarWriter, owner: AvatarOwner, avatarId: null | string) {
    const previousAvatarId =
        owner.kind === 'agent'
            ? await assignAgentAvatar(tx, owner, avatarId)
            : await assignUserAvatar(tx, owner.id, avatarId);

    if (previousAvatarId) {
        await tx.delete(avatarsTable).where(eq(avatarsTable.id, previousAvatarId));
    }
}

async function assignAgentAvatar(tx: AvatarWriter, owner: AvatarOwner, avatarId: null | string) {
    const scope = and(eq(agentsTable.serverId, owner.serverId), eq(agentsTable.id, owner.id));
    const [agent] = await tx
        .select({ avatarId: agentsTable.avatarId })
        .from(agentsTable)
        .where(and(scope, isNull(agentsTable.retiredAt)))
        .limit(1);

    if (!agent) {
        throw new AvatarOwnerNotFoundError('No active Agent exists with that id.');
    }

    await tx.update(agentsTable).set({ avatarId }).where(scope);
    return agent.avatarId;
}

async function assignUserAvatar(tx: AvatarWriter, userId: string, avatarId: null | string) {
    const [user] = await tx
        .select({ avatarId: usersTable.avatarId })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

    if (!user) {
        throw new AvatarOwnerNotFoundError('That human no longer exists.');
    }

    await tx.update(usersTable).set({ avatarId }).where(eq(usersTable.id, userId));
    return user.avatarId;
}
