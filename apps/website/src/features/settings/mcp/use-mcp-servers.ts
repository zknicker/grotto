import { trpc } from '../../../lib/trpc.tsx';

export function useMcpConnections() {
    const utils = trpc.useUtils();
    const invalidate = () => utils.mcp.list.invalidate();
    const listQuery = trpc.mcp.list.useQuery(undefined, { refetchInterval: 4000 });
    const add = trpc.mcp.add.useMutation({ onSuccess: invalidate });
    const addPresetAccount = trpc.mcp.addPresetAccount.useMutation({ onSuccess: invalidate });
    const disconnect = trpc.mcp.disconnect.useMutation({ onSuccess: invalidate });
    const refresh = trpc.mcp.refresh.useMutation();
    const remove = trpc.mcp.delete.useMutation({ onSuccess: invalidate });
    const startOAuth = trpc.mcp.startOAuth.useMutation();
    const update = trpc.mcp.update.useMutation({ onSuccess: invalidate });

    return {
        add: add.mutateAsync,
        addPresetAccount: addPresetAccount.mutateAsync,
        connections: listQuery.data?.connections ?? [],
        disconnect: disconnect.mutateAsync,
        isLoading: listQuery.isPending,
        isSaving:
            add.isPending ||
            addPresetAccount.isPending ||
            disconnect.isPending ||
            refresh.isPending ||
            remove.isPending ||
            startOAuth.isPending ||
            update.isPending,
        listError: listQuery.error?.message ?? null,
        refetch: listQuery.refetch,
        refresh: refresh.mutateAsync,
        remove: remove.mutateAsync,
        startingOAuthId: startOAuth.isPending ? (startOAuth.variables?.connectionId ?? null) : null,
        startOAuth: startOAuth.mutateAsync,
        update: update.mutateAsync,
    };
}
