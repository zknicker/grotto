import { hausTrpc } from '../../lib/haus-server.tsx';
import { withSaveErrorToast } from '../../lib/saving-toast.ts';
import { refreshAgentState } from './agent-refresh.ts';

export function useAgentRestart(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.agent.restart.useMutation({
        onSuccess: () => refreshAgentState(utils, serverId, agentId),
    });
    return {
        ...mutation,
        restart: () =>
            withSaveErrorToast(() => mutation.mutateAsync({ agentId, serverId })).catch(
                () => undefined
            ),
    };
}
