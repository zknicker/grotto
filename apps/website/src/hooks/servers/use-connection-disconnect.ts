import { hausTrpc } from '../../lib/haus-server.tsx';

export function useConnectionDisconnect(serverId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.mcp.disconnect.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
