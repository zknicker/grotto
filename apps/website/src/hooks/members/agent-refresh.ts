import type { hausTrpc } from '../../lib/haus-server.tsx';

type HausUtils = ReturnType<typeof hausTrpc.useUtils>;

export function refreshAgent(utils: HausUtils, serverId: string, agentId: string) {
    return Promise.all([
        utils.agent.get.invalidate({ agentId, serverId }),
        utils.agent.list.invalidate({ serverId }),
    ]);
}

export function refreshAgentState(utils: HausUtils, serverId: string, agentId: string) {
    return Promise.all([
        refreshAgent(utils, serverId, agentId),
        utils.agent.deliveryState.invalidate({ agentId, serverId }),
    ]);
}
