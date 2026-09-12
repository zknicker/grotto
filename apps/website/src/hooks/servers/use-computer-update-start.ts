import { hausTrpc } from '../../lib/haus-server.tsx';

export function useComputerUpdateStart(serverId: string, computerId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.computer.update.useMutation({
        onMutate: async () => {
            await utils.computer.list.cancel({ serverId });
            const previous = utils.computer.list.getData({ serverId });
            utils.computer.list.setData({ serverId }, (computers) =>
                computers?.map((computer) =>
                    computer.id === computerId
                        ? {
                              ...computer,
                              updateActiveAgentCount: null,
                              updateDetail: 'Download requested.',
                              updateDownloadedBytes: null,
                              updateFailedPhase: null,
                              updatePhase: 'requested',
                              updateTotalBytes: null,
                              updateUpdatedAt: new Date().toISOString(),
                          }
                        : computer
                )
            );
            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) {
                utils.computer.list.setData({ serverId }, context.previous);
            }
        },
        onSettled: () => utils.computer.list.invalidate({ serverId }),
    });
}
