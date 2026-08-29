import { keepPreviousData } from '@tanstack/react-query';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useComputerSystemLog(serverId: string, computerId: string, page: number) {
    return grottoTrpc.computer.systemLog.useQuery(
        { computerId, page, serverId },
        { ...queryPolicy.syncedSnapshot, placeholderData: keepPreviousData }
    );
}
