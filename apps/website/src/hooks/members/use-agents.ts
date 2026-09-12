import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useAgents(serverId: string | undefined) {
    return hausTrpc.agent.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}
