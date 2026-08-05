import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { refreshAgentState } from './agent-refresh.ts';

export function useAgentReset(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.reset.useMutation({
        onSuccess: () => refreshAgentState(utils, serverId, agentId),
    });
    return {
        ...mutation,
        reset: (kind: 'full' | 'session') =>
            withSavingToast(() => mutation.mutateAsync({ agentId, kind, serverId }), {
                successNote:
                    kind === 'full'
                        ? 'The Agent will rebuild its workspace from the starter kit.'
                        : 'The Agent will use fresh context on its next turn.',
            }),
    };
}
