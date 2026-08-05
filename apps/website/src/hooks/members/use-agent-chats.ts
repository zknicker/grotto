import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentChats(serverId: string, agentId: string) {
    return grottoTrpc.agent.chats.useQuery({ agentId, serverId });
}
