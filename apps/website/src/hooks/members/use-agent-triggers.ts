import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentTriggers(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.trigger.list.useQuery(
        { agentId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
