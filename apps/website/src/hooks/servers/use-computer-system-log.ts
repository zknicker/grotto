import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useComputerSystemLog(serverId: string, computerId: string) {
    return grottoTrpc.computer.systemLog.useQuery(
        { computerId, serverId },
        queryPolicy.syncedSnapshot
    );
}
