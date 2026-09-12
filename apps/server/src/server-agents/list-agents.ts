import type { HausDatabase } from '../postgres/connection.ts';
import type { HausUser } from '../users/haus-user.ts';
import { queryAgents } from './query-agents.ts';

/** Lists every configured Agent with its desired config and effective status. */
export async function listAgents(db: HausDatabase, member: HausUser | null, serverId: string) {
    return queryAgents(db, member, serverId);
}
