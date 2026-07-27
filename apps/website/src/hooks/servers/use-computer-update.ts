import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useComputerUpdate(serverId: string, computerId: string) {
    const utils = grottoTrpc.useUtils();
    const invalidate = () => utils.computer.list.invalidate({ serverId });
    const check = grottoTrpc.computer.checkUpdate.useMutation({ onSettled: invalidate });
    const update = grottoTrpc.computer.update.useMutation({ onSettled: invalidate });

    return {
        check: () => check.mutate({ computerId, serverId }),
        error: check.error ?? update.error,
        isChecking: check.isPending,
        isStarting: update.isPending,
        update: () => update.mutate({ computerId, serverId }),
    };
}
