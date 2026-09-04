import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Saves the editable half of one Trigger and refreshes the list it appears in. */
export function useTriggerUpdate(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.trigger.update.useMutation({
        onSuccess: () => utils.trigger.list.invalidate({ agentId, serverId }),
    });

    return {
        ...mutation,
        update: (triggerId: string, patch: { instruction?: string | null; title?: string }) =>
            mutation.mutateAsync({ ...patch, serverId, triggerId }),
    };
}
