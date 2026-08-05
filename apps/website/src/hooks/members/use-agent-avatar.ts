import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { refreshAgent } from './agent-refresh.ts';

export function useAgentAvatar(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.avatar.set.useMutation({
        onSuccess: () => refreshAgent(utils, serverId, agentId),
    });
}
