import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useHostedUsage(serverId: string) {
    return grottoTrpc.stats.live.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
