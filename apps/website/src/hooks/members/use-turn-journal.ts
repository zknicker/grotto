import * as React from 'react';
import {
    getTurnJournalPresentation,
    shouldRequestExecutionJournal,
    type TurnDetailAccess,
    type TurnJournalPresentation,
} from '../../features/members/agent-profile/agent-activity-model.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { useAgentExecutionJournal } from './use-agent-execution-journal.ts';

const relayFailure = {
    description: 'The Computer did not return detailed activity.',
    kind: 'unavailable',
    reason: 'timeout',
    title: 'Detailed activity unavailable',
} as const satisfies TurnJournalPresentation;

/**
 * The one owner of a turn's execution-journal relay: it asks while the surface
 * is open and the viewer is allowed, and asks again when the run reports new
 * activity. The journal is ephemeral evidence, so this never enters React
 * Query and never polls.
 */
export function useTurnJournal(input: {
    access: TurnDetailAccess;
    agentId: string | null;
    enabled: boolean;
    live: boolean;
    runId: string | null;
    serverId: string;
}): { isPending: boolean; presentation: TurnJournalPresentation | null } {
    const { access, agentId, enabled, live, runId, serverId } = input;
    const { data, isPending, request, reset, status } = useAgentExecutionJournal();
    const allowed = Boolean(
        shouldRequestExecutionJournal({ access, open: enabled, runId }) && agentId
    );
    const ask = React.useCallback(() => {
        if (allowed && agentId && runId) {
            void request({ agentId, runId, serverId });
        }
    }, [agentId, allowed, request, runId, serverId]);

    React.useEffect(() => {
        if (allowed && agentId && runId) {
            ask();
            return;
        }
        reset();
    }, [agentId, allowed, ask, reset, runId]);

    // Every matching event asks again, with no in-flight guard: the turn's last
    // event usually lands while its predecessor is in flight, and the
    // subscription closes the moment the turn settles, so a skipped event would
    // never be recovered. Overlapping requests are safe — only the newest
    // result is applied.
    grottoTrpc.agent.onActivity.useSubscription(
        { serverId },
        {
            enabled: allowed && live,
            onData: (event) => {
                if (event.agentId === agentId && event.runId === runId) {
                    ask();
                }
            },
        }
    );

    return {
        isPending,
        presentation:
            status === 'success'
                ? getTurnJournalPresentation(data, runId)
                : status === 'error'
                  ? relayFailure
                  : null,
    };
}
