import type { GrottoDatabase } from '../../postgres/connection.ts';
import { listAccessibleServers } from '../../servers/accessible-servers.ts';
import type { GrottoUser } from '../../users/grotto-user.ts';
import { emitServerUpdated } from '../server-events.ts';

/**
 * Announces a profile change after it has committed. One human has one profile
 * shared by every Server they belong to, so a rename or a new handle changes
 * the member directory on all of them: each Server hears its own event naming
 * the human whose record moved. A caller without a signed-in human never wrote
 * anything, so it announces nothing.
 */
export async function announceHumanProfileChange(
    db: GrottoDatabase,
    member: GrottoUser | null
): Promise<void> {
    if (!member) {
        return;
    }

    for (const server of await listAccessibleServers(db, member.id)) {
        emitServerUpdated({ memberId: member.id, serverId: server.id });
    }
}
