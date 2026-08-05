import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentDelete(serverId: string, onDeleted: () => void) {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.agent.delete.useMutation({
        onSuccess: async (_result, input) => {
            await Promise.all([
                utils.agent.get.reset({ agentId: input.agentId, serverId }),
                utils.agent.list.invalidate({ serverId }),
                utils.chat.list.invalidate({ serverId }),
                utils.computer.list.invalidate({ serverId }),
            ]);
            onDeleted();
        },
    });
}
