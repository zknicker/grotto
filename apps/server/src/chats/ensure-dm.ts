import type { HostedChat, HostedDurableEvent } from '@tavern/api';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatsTable, serverMembershipsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { insertHostedLifecycleEvent } from './lifecycle-events.ts';
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

export interface EnsuredHostedDm {
    chat: HostedChat;
    /** Null when the DM already existed; only its first resolution is a lifecycle change. */
    event: HostedDurableEvent | null;
}

export async function ensureHostedDm(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { peerUserId: string; serverId: string }
): Promise<EnsuredHostedDm> {
    const ensured = await db.transaction(async (tx) => {
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

        // Byte order, matching the `collate "C"` comparison in `chats_shape`.
        // User ids are ASCII (`usr_` plus base64url bytes), so JavaScript's
        // code-unit `<` and PostgreSQL's `"C"` collation agree exactly; the
        // database's default collation does not.
        const [memberOne, memberTwo] = [actorStanding, peerStanding].sort((left, right) =>
            left.userId < right.userId ? -1 : 1
        );

        const inserted = await tx
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
            .onConflictDoNothing()
            .returning({ id: chatsTable.id });

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

        const event =
            inserted.length > 0
                ? await insertHostedLifecycleEvent(
                      tx,
                      { chatId: chat.id, serverId: input.serverId },
                      'created',
                      new Date()
                  )
                : null;

        return { chatId: chat.id, event };
    });

    const visibleChat = (await listHostedChats(db, member, input.serverId)).find(
        (candidate) => candidate.id === ensured.chatId
    );

    if (!visibleChat) {
        throw new Error('Failed to open the DM after creating it.');
    }

    return { chat: visibleChat, event: ensured.event };
}
