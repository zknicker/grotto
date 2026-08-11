import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useComputers(serverId: string, options: { enabled?: boolean } = {}) {
    return grottoTrpc.computer.list.useQuery(
        { serverId },
        { ...queryPolicy.syncedSnapshot, enabled: options.enabled }
    );
}
