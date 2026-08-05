import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentGrant(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.mcp.setGrant.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });

    return {
        ...mutation,
        setGrant: (connectionId: string, enabled: boolean) =>
            mutation.mutate({ agentId, connectionId, enabled, serverId }),
    };
}
