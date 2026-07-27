import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useServerReminders(serverId: string) {
    return grottoTrpc.reminder.list.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}

export function useServerReminderRuns(serverId: string, reminderId: string | null) {
    return grottoTrpc.reminder.runs.useQuery(
        { reminderId: reminderId ?? '', serverId },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: reminderId !== null,
        }
    );
}

export function useCancelServerReminder() {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.reminder.cancel.useMutation(createServerReminderCancelMutationOptions(utils));
}

export function createServerReminderCancelMutationOptions(utils: {
    reminder: {
        list: { invalidate(input: { serverId: string }): Promise<unknown> };
        runs: { invalidate(input: { serverId: string }): Promise<unknown> };
    };
}) {
    return {
        onSuccess: async (_result: unknown, input: { serverId: string }) => {
            await Promise.all([
                utils.reminder.list.invalidate({ serverId: input.serverId }),
                utils.reminder.runs.invalidate({ serverId: input.serverId }),
            ]);
        },
    };
}
