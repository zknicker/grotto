import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useReminderList(statuses?: ('scheduled' | 'fired' | 'canceled')[]) {
    // Always pass an object: tRPC's POST override sends an empty body for
    // undefined input, which optional-input procedures reject as bad JSON.
    return trpc.reminder.list.useQuery(statuses ? { statuses } : {}, {
        ...queryPolicy.syncedSnapshot,
    });
}

export function useReminderRuns(reminderId?: string) {
    return trpc.reminder.runs.useQuery(
        reminderId ? { limit: 100, reminderId } : { limit: 100 },
        queryPolicy.syncedSnapshot
    );
}
