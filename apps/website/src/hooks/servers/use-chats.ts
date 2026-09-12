import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useChats(serverId: string | undefined) {
    return hausTrpc.chat.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}
