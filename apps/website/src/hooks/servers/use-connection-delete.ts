import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionDelete(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.mcp.delete.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
