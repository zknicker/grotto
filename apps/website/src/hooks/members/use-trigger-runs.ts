import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** One Trigger's fire history, newest first. Only read while its detail is open. */
export function useTriggerRuns(serverId: string, triggerId: string, enabled: boolean) {
    return grottoTrpc.trigger.runs.useQuery(
        { serverId, triggerId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
