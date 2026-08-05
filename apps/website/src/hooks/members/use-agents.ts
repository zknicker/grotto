import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgents(serverId: string | undefined) {
    return grottoTrpc.agent.list.useQuery(
        { serverId: serverId ?? '' },
        { enabled: serverId !== undefined }
    );
}
