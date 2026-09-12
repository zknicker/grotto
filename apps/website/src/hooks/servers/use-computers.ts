import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useComputers(serverId: string, options: { enabled?: boolean } = {}) {
    return hausTrpc.computer.list.useQuery(
        { serverId },
        { ...queryPolicy.syncedSnapshot, enabled: options.enabled }
    );
}
