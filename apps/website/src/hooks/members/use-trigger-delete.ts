import { hausTrpc } from '../../lib/haus-server.tsx';

/** Removing a Trigger stops it while the Server retains recent fire history. */
export function useTriggerDelete(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.trigger.delete.useMutation({
        onSuccess: async () =>
            await Promise.all([
                utils.trigger.history.invalidate({ agentId, serverId }),
                utils.trigger.list.invalidate({ agentId, serverId }),
            ]),
    });

    return {
        ...mutation,
        deleteTrigger: (triggerId: string) => mutation.mutateAsync({ serverId, triggerId }),
    };
}
