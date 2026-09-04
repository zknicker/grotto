import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Deleting a Trigger takes its fire history with it; chat receipts remain. */
export function useTriggerDelete(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.trigger.delete.useMutation({
        onSuccess: () => utils.trigger.list.invalidate({ agentId, serverId }),
    });

    return {
        ...mutation,
        deleteTrigger: (triggerId: string) => mutation.mutateAsync({ serverId, triggerId }),
    };
}
