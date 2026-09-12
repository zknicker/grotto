import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** One Trigger's fire history, newest first. Only read while its detail is open. */
export function useTriggerRuns(serverId: string, triggerId: string, enabled: boolean) {
    return hausTrpc.trigger.runs.useQuery(
        { serverId, triggerId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
