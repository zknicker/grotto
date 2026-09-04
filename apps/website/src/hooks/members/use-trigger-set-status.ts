import type { TriggerStatus } from '@grotto/api';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { withSaveErrorToast } from '../../lib/saving-toast.ts';

/**
 * Triggers publish no durable event, so this mutation is the single owner of
 * the list read's refresh — there is no listener to defer to.
 */
export function useTriggerSetStatus(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.trigger.setStatus.useMutation({
        onSuccess: () => utils.trigger.list.invalidate({ agentId, serverId }),
    });

    return {
        ...mutation,
        setStatus: (triggerId: string, status: TriggerStatus) =>
            withSaveErrorToast(() => mutation.mutateAsync({ serverId, status, triggerId })).catch(
                () => undefined
            ),
    };
}
