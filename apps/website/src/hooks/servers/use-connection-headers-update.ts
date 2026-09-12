import { hausTrpc } from '../../lib/haus-server.tsx';

export function useConnectionHeadersUpdate(serverId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.mcp.replaceHeaders.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
