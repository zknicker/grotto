import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useTaskAssignees(serverId: string, messageId: string, enabled: boolean) {
    return hausTrpc.task.assignees.useQuery(
        { messageId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
