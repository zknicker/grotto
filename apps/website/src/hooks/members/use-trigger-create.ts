import type { TriggerKind } from '@grotto/api';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/**
 * Triggers publish no durable event, so every mutation owns the list read's
 * refresh itself — there is no listener to defer to.
 */
export function useTriggerCreate(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.trigger.create.useMutation({
        onSuccess: () => utils.trigger.list.invalidate({ agentId, serverId }),
    });

    return {
        ...mutation,
        create: (input: { instruction?: string; kind: TriggerKind; title: string }) =>
            mutation.mutateAsync({ ...input, agentId, serverId }),
    };
}
