import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentState(serverId: string, agentId: string) {
    return grottoTrpc.agent.deliveryState.useQuery({ agentId, serverId });
}
