import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

const previewEventLimit = 5;

export function useAgentActivityPreview(serverId: string, agentId: string) {
    const utils = hausTrpc.useUtils();
    const input = { agentId, limit: previewEventLimit, serverId };
    const invalidate = () => {
        void utils.agent.activityHistory.invalidate(input);
    };

    hausTrpc.agent.onActivity.useSubscription(
        { serverId },
        {
            onData: (event) => {
                if (event.agentId === agentId) {
                    invalidate();
                }
            },
            onStarted: invalidate,
        }
    );

    return hausTrpc.agent.activityHistory.useQuery(input, queryPolicy.syncedSnapshot);
}
