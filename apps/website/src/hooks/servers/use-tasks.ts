import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * The Board and List lens. It hides background-tier tasks by default, so a
 * surface that resolves one specific task by id — a `?task=` deep link, the
 * task peek — passes `includeBackground` and reads the widened lens instead.
 */
export function useTasks(
    serverId: string | undefined,
    chatId?: string,
    options?: { enabled?: boolean; includeBackground?: boolean }
) {
    return hausTrpc.task.list.useQuery(
        // The widening is omitted unless asked for, so the default lens keeps
        // the exact query key the task mutation caches write through.
        {
            ...(chatId ? { chatId } : {}),
            ...(options?.includeBackground ? { includeBackground: true } : {}),
            serverId: serverId ?? '',
        },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && options?.enabled !== false,
        }
    );
}
