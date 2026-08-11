import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useConnections(serverId: string) {
    return grottoTrpc.mcp.list.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
