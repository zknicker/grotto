import { hausTrpc } from '../../lib/haus-server.tsx';
import { refreshAgent } from './agent-refresh.ts';

export function useAgentAvatar(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    return hausTrpc.avatar.set.useMutation({
        onSuccess: () => refreshAgent(utils, serverId, agentId),
    });
}
