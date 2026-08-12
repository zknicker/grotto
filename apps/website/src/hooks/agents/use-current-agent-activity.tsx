import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import {
    applyCurrentAgentActivityEvent,
    type CurrentAgentActivity,
} from './current-agent-activity.ts';

export interface CurrentAgentActivityContextValue {
    activities: readonly CurrentAgentActivity[];
    activityByAgentId: ReadonlyMap<string, CurrentAgentActivity>;
    isSnapshotReady: boolean;
    serverId: string | undefined;
}

const CurrentAgentActivityContext = React.createContext<CurrentAgentActivityContextValue | null>(
    null
);

/**
 * Owns the one hosted current-activity read and committed activity listener
 * for a persistent Server shell. Live events patch only this volatile cache;
 * Activity History remains an independent read and is never invalidated here.
 */
export function useCurrentAgentActivity(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();
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
                utils.agent.activeActivity.setData({ serverId: event.serverId }, (snapshot) => {
                    const activities = applyCurrentAgentActivityEvent(
                        snapshot?.activities ?? [],
                        event
                    );
                    return { activities };
                });
            },
            onStarted: () => {
                if (serverId) {
                    void utils.agent.activeActivity.invalidate({ serverId });
                }
            },
        }
    );

    return query;
}

export function AgentActivityProvider({
    children,
    serverId,
}: {
    children: React.ReactNode;
    serverId: string;
}) {
    const query = useCurrentAgentActivity(serverId);
    const activities = query.data?.activities ?? [];
    const activityByAgentId = React.useMemo(
        () => new Map(activities.map((activity) => [activity.agentId, activity])),
        [activities]
    );
    const value = React.useMemo<CurrentAgentActivityContextValue>(
        () => ({
            activities,
            activityByAgentId,
            isSnapshotReady: query.isSuccess,
            serverId,
        }),
        [activities, activityByAgentId, query.isSuccess, serverId]
    );

    return <CurrentAgentActivityContext value={value}>{children}</CurrentAgentActivityContext>;
}

/** Optional so shared identity components remain renderable in local previews. */
export function useOptionalCurrentAgentActivity() {
    return React.use(CurrentAgentActivityContext);
}
