import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentWorkspace(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.agent.workspaceFiles.useQuery({ agentId, path: '', serverId }, { enabled });
}
