import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * Every reminder this Agent owns, in one read. The section splits the snapshot
 * into a schedule and a history itself (`agent-reminder-model.ts`) rather than
 * asking per status: `reminder.list` filters on a single status, so the two
 * rendered groups would cost three cached reads that settle at three different
 * moments — and a section that is one query is also one refresh owner, which
 * matters while `reminder.changed` has no listener and freshness comes from
 * the synced-snapshot mount and reconnect refetch.
 */
export function useAgentReminders(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.reminder.list.useQuery(
        { agentId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
