import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useArchivedChats(serverId: string) {
    return grottoTrpc.chat.listArchived.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
