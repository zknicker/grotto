import type { AgentRecentTurn } from '@grotto/api';
import * as React from 'react';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { groupTurnsByAgent } from './active-agents.ts';
import { agentTurnWindowDays } from './agent-turn-days.ts';

/**
 * Every Agent's week, as one read.
 *
 * Ranking a strip by "who ran the most this week" is a question about the whole
 * Server, so it is answered by a Server-wide read and grouped here. The version
 * this replaced asked once per Agent through `useQueries`: thirty-four
 * concurrent procedures in one batch, against a ten-connection query pool, is a
 * fan-out the Server cannot absorb — the batch never answered and the strip
 * never drew.
 *
 * Null until the read settles: a blank strip is honest, while a strip ranked
 * against a half-loaded window would reorder under the reader.
 */
export function useAgentWeekTurns(
    serverId: string
): null | ReadonlyMap<string, readonly AgentRecentTurn[]> {
    const utils = grottoTrpc.useUtils();
    const recentTurns = utils.agent.recentTurns;

    grottoTrpc.agent.onLifecycle.useSubscription(
        { serverId },
        {
            enabled: Boolean(serverId),
            onData: (event) => {
                if (event.phase === 'settled') {
                    void recentTurns.invalidate();
                }
            },
            onStarted: () => void recentTurns.invalidate(),
        }
    );

    const turns = grottoTrpc.agent.recentTurns.useQuery(
        { days: agentTurnWindowDays, serverId },
        { ...queryPolicy.syncedSnapshot, enabled: Boolean(serverId) }
    );

    return React.useMemo(
        () => (turns.data === undefined ? null : groupTurnsByAgent(turns.data)),
        [turns.data]
    );
}
