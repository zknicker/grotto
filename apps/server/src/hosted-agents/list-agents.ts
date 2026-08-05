import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { queryHostedAgents } from './query-agents.ts';

/** Lists every configured Agent with its desired config and effective status. */
export async function listHostedAgents(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
) {
    return queryHostedAgents(db, member, serverId);
}
