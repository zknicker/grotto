import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useComputerUpdateCheck(serverId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.computer.checkUpdate.useMutation({
        onSettled: () => utils.computer.list.invalidate({ serverId }),
    });
}
