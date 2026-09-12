import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useUsage(serverId: string) {
    return hausTrpc.stats.live.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
