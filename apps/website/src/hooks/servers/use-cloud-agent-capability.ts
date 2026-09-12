import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export interface CloudAgentCapabilityTarget {
    computerId: string;
    provider: 'cursor';
    serverId: string;
}

export function useCloudAgentCapability(target: CloudAgentCapabilityTarget, enabled: boolean) {
    return hausTrpc.cloudAgentProvider.get.useQuery(target, {
        ...queryPolicy.computerSnapshot,
        enabled,
    });
}

/**
 * Connecting runs Cursor's browser sign-in on the Computer, so the mutation
 * stays pending for as long as the human takes. Its answer is the Computer's
 * own readiness, which also refreshes the Computer report behind it.
 */
export function useCloudAgentConnect(target: CloudAgentCapabilityTarget) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.cloudAgentProvider.connect.useMutation({
        onSettled: async () => {
            await Promise.all([
                utils.cloudAgentProvider.get.invalidate(target),
                utils.computer.list.invalidate({ serverId: target.serverId }),
            ]);
        },
    });
}

export function useCloudAgentDisconnect(target: CloudAgentCapabilityTarget) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.cloudAgentProvider.disconnect.useMutation({
        onSettled: async () => {
            await Promise.all([
                utils.cloudAgentProvider.get.invalidate(target),
                utils.computer.list.invalidate({ serverId: target.serverId }),
            ]);
        },
    });
}
