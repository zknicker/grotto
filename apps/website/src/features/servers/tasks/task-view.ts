import { useSearchParams } from 'react-router-dom';
import { resolveTaskView } from './task-model.ts';

export type TaskLayout = 'board' | 'list';

export function useTaskView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const layout = searchParams.get('layout') === 'list' ? 'list' : 'board';

    return {
        filters: {
            labelId: searchParams.get('label'),
            query: searchParams.get('q') ?? '',
            view: resolveTaskView(searchParams.get('view')),
        },
        layout,
        setQuery: (query: string) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (query) {
                        next.set('q', query);
                    } else {
                        next.delete('q');
                    }
                    return next;
                },
                { replace: true }
            );
        },
        setLayout: (nextLayout: TaskLayout) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (nextLayout === 'board') {
                        next.delete('layout');
                    } else {
                        next.set('layout', nextLayout);
                    }
                    return next;
                },
                { replace: true }
            );
        },
    };
}
