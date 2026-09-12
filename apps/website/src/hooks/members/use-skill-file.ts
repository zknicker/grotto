import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useSkillFile(serverId: string, agentId: string, name: string, enabled: boolean) {
    return hausTrpc.agent.skillFile.useQuery(
        { agentId, name, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
