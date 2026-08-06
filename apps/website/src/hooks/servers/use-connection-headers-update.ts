import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionHeadersUpdate(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.mcp.replaceHeaders.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
