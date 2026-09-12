import { hausTrpc } from '../../lib/haus-server.tsx';

export function useConnectionPresetAdd(serverId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.mcp.addPresetAccount.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
