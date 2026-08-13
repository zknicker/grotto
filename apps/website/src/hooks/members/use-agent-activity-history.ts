import { useQueries } from '@tanstack/react-query';
import type {
    AgentActivityCursor,
    AgentActivityEvent,
    AgentActivityHistoryPage,
} from '@tavern/api';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

const activityPageSize = 50;

export function useAgentActivityHistory(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const scope = `${serverId}:${agentId}`;
    const [cursors, setCursors] = React.useState<Array<AgentActivityCursor | undefined>>([
        undefined,
    ]);
    const scopeRef = React.useRef(scope);
    const activeCursors = scopeRef.current === scope ? cursors : [undefined];

    React.useEffect(() => {
        if (scopeRef.current === scope) {
            return;
        }
        scopeRef.current = scope;
        setCursors([undefined]);
    }, [scope]);

    const invalidateLatestPage = React.useCallback(() => {
        void utils.agent.activityHistory.invalidate({
            agentId,
            limit: activityPageSize,
            serverId,
        });
    }, [agentId, serverId, utils.agent.activityHistory]);

    grottoTrpc.agent.onActivity.useSubscription(
        { serverId },
        {
            enabled: Boolean(serverId && agentId),
            onData: (event) => {
                if (event.agentId === agentId) {
                    invalidateLatestPage();
                }
            },
            onStarted: invalidateLatestPage,
        }
    );

    const pages = useQueries({
        queries: activeCursors.map((before) =>
            utils.agent.activityHistory.queryOptions(
                {
                    agentId,
                    limit: activityPageSize,
                    ...(before ? { before } : {}),
                    serverId,
                },
                {
                    ...queryPolicy.syncedSnapshot,
                    enabled: Boolean(serverId && agentId),
                }
            )
        ),
    });
    const lastPage = pages.at(-1);
    const nextBefore = lastPage?.data?.nextBefore ?? null;
    const isFetching = pages.some((page) => page.isFetching);
    const error = pages.find((page) => page.error)?.error ?? null;
    const events = React.useMemo(() => dedupeEvents(pages), [pages]);
    const loadMore = React.useCallback(() => {
        if (!nextBefore || isFetching) {
            return;
        }
        setCursors((current) => {
            const last = current.at(-1);
            if (last?.runId === nextBefore.runId && last.position === nextBefore.position) {
                return current;
            }
            return [...current, nextBefore];
        });
    }, [isFetching, nextBefore]);

    return {
        error,
        events,
        hasMore: nextBefore !== null,
        isFetching,
        isPending: pages[0]?.isPending ?? true,
        loadMore,
    };
}

export function useAgentTurnActivityHistory(
    serverId: string,
    agentId: string,
    runId: string | null
) {
    return grottoTrpc.agent.activityHistory.useQuery(
        {
            agentId,
            limit: 100,
            runId: runId ?? 'run_missing',
            serverId,
        },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: Boolean(serverId && agentId && runId),
        }
    );
}

function dedupeEvents(
    pages: Array<{
        data?: AgentActivityHistoryPage;
    }>
): AgentActivityEvent[] {
    const seen = new Set<string>();
    const events: AgentActivityEvent[] = [];
    for (const page of pages) {
        for (const event of page.data?.events ?? []) {
            if (seen.has(event.id)) {
                continue;
            }
            seen.add(event.id);
            events.push(event);
        }
    }
    return events;
}
