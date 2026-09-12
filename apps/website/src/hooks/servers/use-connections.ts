import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** The MCP connections configured on one Server. */
export function useConnections(serverId: string) {
    return hausTrpc.mcp.list.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
