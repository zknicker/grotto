import type { grottoTrpc } from '../../lib/grotto-server.tsx';

type GrottoUtils = ReturnType<typeof grottoTrpc.useUtils>;

export function refreshAgent(utils: GrottoUtils, serverId: string, agentId: string) {
    return Promise.all([
        utils.agent.get.invalidate({ agentId, serverId }),
        utils.agent.list.invalidate({ serverId }),
    ]);
}

export function refreshAgentState(utils: GrottoUtils, serverId: string, agentId: string) {
    return Promise.all([
        refreshAgent(utils, serverId, agentId),
        utils.agent.deliveryState.invalidate({ agentId, serverId }),
    ]);
}
