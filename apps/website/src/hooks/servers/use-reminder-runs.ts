import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useReminderRuns(serverId: string, reminderId: string | null) {
    return grottoTrpc.reminder.runs.useQuery(
        { reminderId: reminderId ?? '', serverId },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: reminderId !== null,
        }
    );
}
