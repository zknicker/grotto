import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useReminderCancel() {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.reminder.cancel.useMutation(createReminderCancelOptions(utils));
}

export function createReminderCancelOptions(utils: {
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
