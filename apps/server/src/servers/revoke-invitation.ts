import type { ServerInvitation } from '@tavern/api';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { serverInvitationsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import {
    InvitationNotFoundError,
    invitationColumns,
    requireInvitationAuthority,
    toServerInvitation,
} from './invitation-access.ts';

/**
 * Revocation is immediate and only applies to a live invitation. An already
 * accepted or revoked invitation is not found, so revoking never rewrites a
 * consumed one.
 */
export async function revokeServerInvitation(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { invitationId: string; serverId: string }
): Promise<ServerInvitation> {
    const server = await requireInvitationAuthority(db, member, input.serverId);
    const [revoked] = await db
        .update(serverInvitationsTable)
        .set({ revokedAt: sql`now()` })
        .where(
            and(
                eq(serverInvitationsTable.serverId, server.id),
                eq(serverInvitationsTable.id, input.invitationId),
                isNull(serverInvitationsTable.acceptedAt),
                isNull(serverInvitationsTable.revokedAt)
            )
        )
        .returning(invitationColumns);

    if (!revoked) {
        throw new InvitationNotFoundError();
    }

    return toServerInvitation(revoked);
}
