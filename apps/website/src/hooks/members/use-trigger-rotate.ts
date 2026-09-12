import { hausTrpc } from '../../lib/haus-server.tsx';

/** Mints a replacement secret. Its response is the only place that secret exists. */
export function useTriggerRotate(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.trigger.rotate.useMutation({
        onSuccess: () => utils.trigger.list.invalidate({ agentId, serverId }),
    });

    return {
        ...mutation,
        rotate: (triggerId: string) => mutation.mutateAsync({ serverId, triggerId }),
    };
}
