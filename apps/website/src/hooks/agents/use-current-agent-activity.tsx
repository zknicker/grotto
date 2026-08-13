import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import { useAgents } from '../members/use-agents.ts';
import {
    type CurrentAgentActivity,
    filterCurrentAgentActivityByAvailability,
    reconcileCurrentAgentActivity,
} from './current-agent-activity.ts';

export interface CurrentAgentActivityContextValue {
    activities: readonly CurrentAgentActivity[];
    isSnapshotReady: boolean;
    serverId: string | undefined;
}

const CurrentAgentActivityContext = React.createContext<CurrentAgentActivityContextValue | null>(
    null
);

/**
 * Owns the one Server current-activity read and committed activity listener
 * for a persistent Server shell. Live events patch only this volatile cache;
 * Activity History remains an independent read and is never invalidated here.
 */
export function useCurrentAgentActivity(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();
    const [liveState, setLiveState] = React.useState<{
        byAgentId: ReadonlyMap<string, CurrentAgentActivity>;
        serverId: string | undefined;
    }>({ byAgentId: new Map(), serverId });
    const query = grottoTrpc.agent.activeActivity.useQuery(
        { serverId: serverId ?? '' },
        {
            ...queryPolicy.volatileState,
            enabled: serverId !== undefined,
        }
    );

    grottoTrpc.agent.onActivity.useSubscription(
        { serverId: serverId ?? '' },
        {
            enabled: serverId !== undefined,
            onData: (event) => {
                if (event.serverId !== serverId) {
                    return;
                }
                setLiveState((current) => {
                    const currentEvents =
                        current.serverId === event.serverId ? current.byAgentId : new Map();
                    const previous = currentEvents.get(event.agentId);
                    if (previous?.runId === event.runId && previous.position >= event.position) {
                        return current;
                    }
                    const next = new Map(currentEvents);
                    next.set(event.agentId, event);
                    return { byAgentId: next, serverId: event.serverId };
                });
            },
            onStarted: () => {
                setLiveState({ byAgentId: new Map(), serverId });
                if (serverId) {
                    void utils.agent.activeActivity.invalidate({ serverId });
                }
            },
        }
    );

    const activities = React.useMemo(
        () =>
            reconcileCurrentAgentActivity(
                query.data?.activities ?? [],
                liveState.serverId === serverId ? [...liveState.byAgentId.values()] : []
            ),
        [liveState, query.data?.activities, serverId]
    );
    return { ...query, data: query.data ? { activities } : query.data };
}

export function AgentActivityProvider({
    children,
    serverId,
}: {
    children: React.ReactNode;
    serverId: string;
}) {
    const query = useCurrentAgentActivity(serverId);
    const agents = useAgents(serverId);
    const activities = React.useMemo(
        () =>
            filterCurrentAgentActivityByAvailability(
                query.data?.activities ?? [],
                agents.data ?? []
            ),
        [agents.data, query.data?.activities]
    );
    const value = React.useMemo<CurrentAgentActivityContextValue>(
        () => ({
            activities,
            isSnapshotReady: query.isSuccess && agents.isSuccess,
            serverId,
        }),
        [activities, agents.isSuccess, query.isSuccess, serverId]
    );

    return <CurrentAgentActivityContext value={value}>{children}</CurrentAgentActivityContext>;
}

/** Optional so shared identity components remain renderable in local previews. */
export function useOptionalCurrentAgentActivity() {
    return React.use(CurrentAgentActivityContext);
}
