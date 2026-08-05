import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { withSaveErrorToast } from '../../lib/saving-toast.ts';
import { refreshAgentState } from './agent-refresh.ts';

export function useAgentStop(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.stop.useMutation({
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
