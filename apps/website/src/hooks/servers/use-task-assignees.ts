import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useTaskAssignees(serverId: string, messageId: string, enabled: boolean) {
    return grottoTrpc.task.assignees.useQuery(
        { messageId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
