import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionPresetAdd(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.mcp.addPresetAccount.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
}
