import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** The history drawer reads the newest fires; the Server applies the retention window. */
export const TRIGGER_HISTORY_LIMIT = 200;

export function useAgentTriggerHistory(serverId: string, agentId: string, enabled: boolean) {
    return hausTrpc.trigger.history.useQuery(
        { agentId, limit: TRIGGER_HISTORY_LIMIT, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
