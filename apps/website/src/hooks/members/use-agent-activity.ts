import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentActivity(serverId: string, agentId: string) {
    return grottoTrpc.agent.activity.useQuery(
        { agentId, limit: 50, serverId },
        queryPolicy.syncedSnapshot
    );
}
