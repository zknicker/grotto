import type { ServerMemberDirectory } from '@tavern/api';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { serverMembershipsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { toServerMember } from './member-access.ts';
import { requireServerMembership } from './server-access.ts';

/**
 * Every current member can see who else is on the Server. The App needs it to
 * name authors and to drop live signals from humans who have left; management
 * affordances are gated by the viewer's own role, which rides along here.
 */
export async function listServerMembers(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<ServerMemberDirectory> {
    const server = await requireServerMembership(db, member, serverId);

    if (!member) {
        throw new Error('A Server member is required to read the member directory.');
    }

    const memberships = await db
        .select({
            joinedAt: serverMembershipsTable.joinedAt,
            role: serverMembershipsTable.role,
            userId: serverMembershipsTable.userId,
        })
        .from(serverMembershipsTable)
        .where(
            and(
                eq(serverMembershipsTable.serverId, server.id),
                isNull(serverMembershipsTable.revokedAt)
            )
        )
        .orderBy(asc(serverMembershipsTable.joinedAt), asc(serverMembershipsTable.userId));

    return {
        members: memberships.map(toServerMember),
        viewerRole: server.role,
        viewerUserId: member.id,
    };
}
