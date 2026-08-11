import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgent(serverId: string, agentId: string | undefined) {
    return grottoTrpc.agent.get.useQuery(
        { agentId: agentId ?? '', serverId },
        { ...queryPolicy.syncedSnapshot, enabled: agentId !== undefined }
    );
}
