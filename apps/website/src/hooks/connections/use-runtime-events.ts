import { trpc } from '../../lib/trpc.tsx';

export function useRuntimeConnectionEvents() {
    const utils = trpc.useUtils();

    trpc.agentRuntime.onUpdate.useSubscription(undefined, {
        onData: () => {
            utils.agentRuntime.get.invalidate().catch(() => undefined);
            utils.agentRuntime.updateStatus.invalidate().catch(() => undefined);
        },
    });
}

export function useRuntimeCapabilityEvents() {
    const utils = trpc.useUtils();

    trpc.agentRuntime.onCapabilityUpdated.useSubscription(undefined, {
        onData: () => {
            utils.agentRuntime.get.invalidate().catch(() => undefined);
        },
    });
}
