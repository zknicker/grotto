import { useSearchParams } from 'react-router-dom';
import type { ReminderFilters } from './reminder-model.ts';

export function useReminderView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const status = resolveReminderStatus(searchParams.get('status'));

    function setFilter(name: 'agent' | 'q' | 'status', value: string | null) {
        setSearchParams(
            (params) => {
                const next = new URLSearchParams(params);
                if (value) {
                    next.set(name, value);
                } else {
                    next.delete(name);
                }
                return next;
            },
            { replace: true }
        );
    }

    return {
        filters: {
            agentId: searchParams.get('agent'),
            query: searchParams.get('q') ?? '',
            status,
        } satisfies ReminderFilters,
        setAgentId: (agentId: string | null) => setFilter('agent', agentId),
        setQuery: (query: string) => setFilter('q', query),
        setStatus: (nextStatus: ReminderFilters['status']) =>
            setFilter('status', nextStatus === 'all' ? null : nextStatus),
    };
}

function resolveReminderStatus(value: string | null): ReminderFilters['status'] {
    return value === 'canceled' || value === 'fired' || value === 'scheduled' ? value : 'all';
}
