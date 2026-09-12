import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentTriggers(serverId: string, agentId: string, enabled: boolean) {
    return hausTrpc.trigger.list.useQuery(
        { agentId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
