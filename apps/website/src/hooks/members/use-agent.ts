import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgent(serverId: string, agentId: string | undefined) {
    return hausTrpc.agent.get.useQuery(
        { agentId: agentId ?? '', serverId },
        { ...queryPolicy.syncedSnapshot, enabled: agentId !== undefined }
    );
}
