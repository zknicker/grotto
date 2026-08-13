import { useSearchParams } from 'react-router-dom';
import { resolveTaskView } from './task-model.ts';

export type TaskLayout = 'board' | 'list';

export function useTaskView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const layout = searchParams.get('layout') === 'board' ? 'board' : 'list';

    return {
        // Close deletes with replace so Back from a closed dialog leaves the
        // page; open pushes an entry so Back closes an open dialog.
        closeTask: () => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    next.delete('task');
                    return next;
                },
                { replace: true }
            );
        },
        filters: {
            labelId: searchParams.get('label'),
            query: searchParams.get('q') ?? '',
            view: resolveTaskView(searchParams.get('view')),
        },
        layout,
        openTask: (messageId: string) => {
            setSearchParams((params) => {
                const next = new URLSearchParams(params);
                next.set('task', messageId);
                return next;
            });
        },
        openTaskId: searchParams.get('task'),
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
                    if (nextLayout === 'list') {
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
