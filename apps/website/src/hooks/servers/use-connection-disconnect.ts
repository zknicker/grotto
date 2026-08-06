import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionDisconnect(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.mcp.disconnect.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
