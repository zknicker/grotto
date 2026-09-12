import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentState(serverId: string, agentId: string) {
    return hausTrpc.agent.deliveryState.useQuery({ agentId, serverId }, queryPolicy.syncedSnapshot);
}
