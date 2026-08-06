import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useTasks(
    serverId: string | undefined,
    chatId?: string,
    options?: { enabled?: boolean }
) {
    return grottoTrpc.task.list.useQuery(
        { ...(chatId ? { chatId } : {}), serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && options?.enabled !== false,
        }
    );
}
