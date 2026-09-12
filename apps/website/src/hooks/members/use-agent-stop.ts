import { hausTrpc } from '../../lib/haus-server.tsx';
import { withSaveErrorToast } from '../../lib/saving-toast.ts';
import { refreshAgentState } from './agent-refresh.ts';

export function useAgentStop(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.agent.stop.useMutation({
        onSuccess: () => refreshAgentState(utils, serverId, agentId),
    });
    return {
        ...mutation,
        stop: () =>
            withSaveErrorToast(() => mutation.mutateAsync({ agentId, serverId })).catch(
                () => undefined
            ),
    };
}
