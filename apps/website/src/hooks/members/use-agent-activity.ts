import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentActivity(serverId: string, agentId: string) {
    return grottoTrpc.agent.activity.useQuery({ agentId, limit: 50, serverId });
}
