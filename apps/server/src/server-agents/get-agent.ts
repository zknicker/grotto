import type { Agent } from '@grotto/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { queryAgents } from './query-agents.ts';

export async function getAgent(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string,
    agentId: string
): Promise<Agent | null> {
    return (await queryAgents(db, member, serverId, agentId))[0] ?? null;
}
