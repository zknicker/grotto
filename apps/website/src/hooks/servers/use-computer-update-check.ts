import { hausTrpc } from '../../lib/haus-server.tsx';

export function useComputerUpdateCheck(serverId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.computer.checkUpdate.useMutation({
        onSettled: () => utils.computer.list.invalidate({ serverId }),
    });
}
