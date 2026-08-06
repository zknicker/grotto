import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useReminders(serverId: string) {
    return grottoTrpc.reminder.list.useQuery({ serverId }, queryPolicy.syncedSnapshot);
}
