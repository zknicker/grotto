import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentState(serverId: string, agentId: string) {
    return grottoTrpc.agent.deliveryState.useQuery(
        { agentId, serverId },
        queryPolicy.syncedSnapshot
    );
}
