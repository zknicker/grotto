import type { TriggerKind } from '@haus/api';
import { hausTrpc } from '../../lib/haus-server.tsx';

/**
 * Triggers publish no durable event, so every mutation owns the list read's
 * refresh itself — there is no listener to defer to.
 */
export function useTriggerCreate(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.trigger.create.useMutation({
        onSuccess: () => utils.trigger.list.invalidate({ agentId, serverId }),
    });

    return {
        ...mutation,
        create: (input: { instruction?: string; kind: TriggerKind; title: string }) =>
            mutation.mutateAsync({ ...input, agentId, serverId }),
    };
}
