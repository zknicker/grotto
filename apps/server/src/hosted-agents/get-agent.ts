import type { HostedAgent } from '@tavern/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { queryHostedAgents } from './query-agents.ts';

export async function getHostedAgent(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string,
    agentId: string
): Promise<HostedAgent | null> {
    return (await queryHostedAgents(db, member, serverId, agentId))[0] ?? null;
}
