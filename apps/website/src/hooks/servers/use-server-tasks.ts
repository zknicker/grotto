import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useServerTasks(serverId: string | undefined, chatId?: string) {
    return grottoTrpc.task.list.useQuery(
        { ...(chatId ? { chatId } : {}), serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}
