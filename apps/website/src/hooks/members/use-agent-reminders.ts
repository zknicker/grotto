import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentReminders(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.reminder.list.useQuery(
        { agentId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
