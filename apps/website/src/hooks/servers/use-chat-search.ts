import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useChatSearch(serverId: string | undefined, query: string) {
    return grottoTrpc.chat.search.useQuery(
        { query, serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && query.length > 0,
        }
    );
}
