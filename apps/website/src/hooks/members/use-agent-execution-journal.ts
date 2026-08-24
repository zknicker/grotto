import type { AgentExecutionJournalInput, AgentExecutionJournalResult } from '@grotto/api';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

type JournalState =
    | { data: null; error: null; status: 'idle' }
    | { data: null; error: null; status: 'loading' }
    | { data: AgentExecutionJournalResult; error: null; status: 'success' }
    | { data: null; error: unknown; status: 'error' };

const initialState: JournalState = { data: null, error: null, status: 'idle' };

/**
 * One-shot detail relay. This intentionally uses the raw tRPC client instead
 * of a query utility: a Computer journal is ephemeral and must not enter the
 * React Query or durable Server cache.
 */
export function useAgentExecutionJournal() {
    const { client } = grottoTrpc.useUtils();
    const requestRef = React.useRef(0);
    const [state, setState] = React.useState<JournalState>(initialState);

    const reset = React.useCallback(() => {
        requestRef.current += 1;
        setState(initialState);
    }, []);

    const request = React.useCallback(
        async (input: AgentExecutionJournalInput) => {
            const requestId = requestRef.current + 1;
            requestRef.current = requestId;
            setState({ data: null, error: null, status: 'loading' });
            try {
                const data = await client.agent.executionJournal.query(input);
                if (requestRef.current === requestId) {
                    setState({ data, error: null, status: 'success' });
                }
                return data;
            } catch (error) {
                if (requestRef.current === requestId) {
                    setState({ data: null, error, status: 'error' });
                }
                return null;
            }
        },
        [client]
    );

    return {
        data: state.data,
        error: state.error,
        isPending: state.status === 'loading',
        isSuccess: state.status === 'success',
        request,
        reset,
        status: state.status,
    };
}
