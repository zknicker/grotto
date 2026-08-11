import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentWorkspace(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.agent.workspaceFiles.useQuery(
        { agentId, path: '', serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
