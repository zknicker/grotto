import type { ServerMember } from '@grotto/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import {
    findCurrentMembership,
    ServerMemberNotFoundError,
    toServerMember,
} from './member-access.ts';
import { requireServerMembership } from './server-access.ts';

/** One current human member, readable by any other current Server member. */
export async function getServerMember(
    db: GrottoDatabase,
    viewer: GrottoUser | null,
    serverId: string,
    userId: string
): Promise<ServerMember> {
    await requireServerMembership(db, viewer, serverId);
    const member = await findCurrentMembership(db, serverId, userId);

    if (!member) {
        throw new ServerMemberNotFoundError();
    }

    return toServerMember(member);
}
