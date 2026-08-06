import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useComputerRemove(serverId: string, onRemoved: () => void) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.computer.remove.useMutation({
        onSuccess: () => {
            onRemoved();
            void utils.computer.list.invalidate({ serverId });
        },
    });
}
