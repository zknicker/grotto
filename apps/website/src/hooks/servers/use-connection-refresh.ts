import { hausTrpc } from '../../lib/haus-server.tsx';

export function useConnectionRefresh(serverId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.mcp.refresh.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
