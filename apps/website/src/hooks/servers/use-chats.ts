import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useChats(serverId: string | undefined) {
    return grottoTrpc.chat.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}
