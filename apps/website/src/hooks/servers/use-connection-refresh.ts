import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionRefresh(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.mcp.refresh.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
