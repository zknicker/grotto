import { hausTrpc } from '../../lib/haus-server.tsx';

export function useAgentGrant(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.mcp.setGrant.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });

    return {
        ...mutation,
        setGrant: (connectionId: string, enabled: boolean) =>
            mutation.mutate({ agentId, connectionId, enabled, serverId }),
    };
}
