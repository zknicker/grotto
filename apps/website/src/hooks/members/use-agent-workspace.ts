import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgentWorkspace(serverId: string, agentId: string, enabled: boolean) {
    return hausTrpc.agent.workspaceFiles.useQuery(
        { agentId, path: '', serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
