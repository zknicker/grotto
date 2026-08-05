import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { refreshAgent } from './agent-refresh.ts';

export function useAgentRuntime(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.configure.useMutation({
        onSuccess: () => refreshAgent(utils, serverId, agentId),
    });

    return {
        ...mutation,
        save: async (draft: { modelId: string; runtimeId: string }) => {
            await withSavingToast(() => mutation.mutateAsync({ agentId, serverId, ...draft }));
        },
    };
}
