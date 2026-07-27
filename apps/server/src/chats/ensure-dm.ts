import type { HostedChat } from '@tavern/api';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatsTable, serverMembershipsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
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
    const chatId = await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireServerMembership(tx, member, input.serverId);

        if (!member || member.id === input.peerUserId) {
            throw new InvalidDmPeerError();
        }

        const standings = await tx
            .select({
                stint: serverMembershipsTable.stint,
                userId: serverMembershipsTable.userId,
            })
            .from(serverMembershipsTable)
            .where(
                and(
                    eq(serverMembershipsTable.serverId, input.serverId),
                    inArray(serverMembershipsTable.userId, [member.id, input.peerUserId]),
                    isNull(serverMembershipsTable.revokedAt)
                )
            );
        const actorStanding = standings.find((standing) => standing.userId === member.id);
        const peerStanding = standings.find((standing) => standing.userId === input.peerUserId);

        if (!(actorStanding && peerStanding)) {
            throw new DmPeerNotFoundError();
        }

        const [memberOne, memberTwo] = [actorStanding, peerStanding].sort((left, right) =>
            left.userId < right.userId ? -1 : 1
        );

        await tx
            .insert(chatsTable)
            .values({
                dmMemberOneStint: memberOne.stint,
                dmMemberOneUserId: memberOne.userId,
                dmMemberTwoStint: memberTwo.stint,
                dmMemberTwoUserId: memberTwo.userId,
                id: createOpaqueId('cht'),
                kind: 'dm',
                serverId: input.serverId,
            })
            .onConflictDoNothing();

        const [chat] = await tx
            .select({ id: chatsTable.id })
            .from(chatsTable)
            .where(
                and(
                    eq(chatsTable.serverId, input.serverId),
                    eq(chatsTable.kind, 'dm'),
                    eq(chatsTable.dmMemberOneUserId, memberOne.userId),
                    eq(chatsTable.dmMemberTwoUserId, memberTwo.userId),
                    eq(chatsTable.dmMemberOneStint, memberOne.stint),
                    eq(chatsTable.dmMemberTwoStint, memberTwo.stint)
                )
            )
            .limit(1);

        if (!chat) {
            throw new Error('Failed to resolve the DM after creating it.');
        }

        return chat.id;
    });

    const visibleChat = (await listHostedChats(db, member, input.serverId)).find(
        (candidate) => candidate.id === chatId
    );

    if (!visibleChat) {
        throw new Error('Failed to open the DM after creating it.');
    }

    return visibleChat;
}
