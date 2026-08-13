import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { queryAgents } from './query-agents.ts';

/** Lists every configured Agent with its desired config and effective status. */
export async function listAgents(db: GrottoDatabase, member: GrottoUser | null, serverId: string) {
    return queryAgents(db, member, serverId);
}
