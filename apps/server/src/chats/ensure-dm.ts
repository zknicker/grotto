import type { HostedChat } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatsTable, serverMembershipsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { listHostedChats } from './list-chats.ts';

export class DmPeerNotFoundError extends Error {
    constructor() {
        super('That User is not a member of this Server.');
        this.name = 'DmPeerNotFoundError';
    }
}

export class InvalidDmPeerError extends Error {
    constructor() {
        super('A DM requires another Server member.');
        this.name = 'InvalidDmPeerError';
    }
}

export async function ensureHostedDm(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { peerUserId: string; serverId: string }
): Promise<HostedChat> {
    await requireServerMembership(db, member, input.serverId);

    if (!member || member.id === input.peerUserId) {
        throw new InvalidDmPeerError();
    }

    const [peer] = await db
        .select({ userId: serverMembershipsTable.userId })
        .from(serverMembershipsTable)
        .where(
            and(
                eq(serverMembershipsTable.serverId, input.serverId),
                eq(serverMembershipsTable.userId, input.peerUserId)
            )
        )
        .limit(1);

    if (!peer) {
        throw new DmPeerNotFoundError();
    }

    const [memberOneUserId, memberTwoUserId] = [member.id, peer.userId].sort();

    await db
        .insert(chatsTable)
        .values({
            dmMemberOneUserId: memberOneUserId,
            dmMemberTwoUserId: memberTwoUserId,
            id: createOpaqueId('cht'),
            kind: 'dm',
            serverId: input.serverId,
        })
        .onConflictDoNothing();

    const [chat] = await db
        .select()
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                eq(chatsTable.kind, 'dm'),
                eq(chatsTable.dmMemberOneUserId, memberOneUserId),
                eq(chatsTable.dmMemberTwoUserId, memberTwoUserId)
            )
        )
        .limit(1);

    if (!chat) {
        throw new Error('Failed to resolve the DM after creating it.');
    }

    const visibleChat = (await listHostedChats(db, member, input.serverId)).find(
        (candidate) => candidate.id === chat.id
    );

    if (!visibleChat) {
        throw new Error('Failed to open the DM after creating it.');
    }

    return visibleChat;
}
