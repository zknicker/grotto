import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgent(serverId: string, agentId: string | undefined) {
    return grottoTrpc.agent.get.useQuery(
        { agentId: agentId ?? '', serverId },
        { enabled: agentId !== undefined }
    );
}
