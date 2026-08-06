import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionAdd(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.mcp.add.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
