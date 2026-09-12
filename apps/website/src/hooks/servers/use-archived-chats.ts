import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useArchivedChats(serverId: string) {
    return hausTrpc.chat.listArchived.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
