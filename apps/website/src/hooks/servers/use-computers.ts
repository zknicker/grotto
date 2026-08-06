import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useComputers(
    serverId: string,
    options: { enabled?: boolean; staleTime?: number } = {}
) {
    return grottoTrpc.computer.list.useQuery(
        { serverId },
        { enabled: options.enabled, staleTime: options.staleTime }
    );
}
