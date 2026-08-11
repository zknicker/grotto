import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** The MCP connections configured on one Server. */
export function useConnections(serverId: string) {
    return grottoTrpc.mcp.list.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
