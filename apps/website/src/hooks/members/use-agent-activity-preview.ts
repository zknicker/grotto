import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

const previewEventLimit = 5;

export function useAgentActivityPreview(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const input = { agentId, limit: previewEventLimit, serverId };
    const invalidate = () => {
        void utils.agent.activityHistory.invalidate(input);
    };

    grottoTrpc.agent.onActivity.useSubscription(
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

    return grottoTrpc.agent.activityHistory.useQuery(input, queryPolicy.syncedSnapshot);
}
