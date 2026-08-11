import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useComputers(
    serverId: string,
    options: { enabled?: boolean; staleTime?: number } = {}
) {
    return grottoTrpc.computer.list.useQuery(
        { serverId },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: options.enabled,
            staleTime: options.staleTime ?? queryPolicy.syncedSnapshot.staleTime,
        }
    );
}
