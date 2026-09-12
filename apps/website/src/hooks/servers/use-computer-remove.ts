import { hausTrpc } from '../../lib/haus-server.tsx';

export function useComputerRemove(serverId: string, onRemoved: () => void) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.computer.remove.useMutation({
        onSuccess: () => {
            onRemoved();
            void utils.computer.list.invalidate({ serverId });
        },
    });
}
