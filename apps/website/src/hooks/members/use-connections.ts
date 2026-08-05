import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnections(serverId: string) {
    return grottoTrpc.mcp.list.useQuery({ serverId });
}
