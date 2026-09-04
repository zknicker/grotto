import { useSearchParams } from 'react-router-dom';
import { resolveTaskView, type TaskView } from './task-model.ts';

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
            assignee: searchParams.get('assignee'),
            chatId: searchParams.get('chat'),
            labelId: searchParams.get('label'),
            priority: searchParams.get('priority'),
            status: searchParams.get('status'),
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
        setAssignee: (assignee: null | string) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (assignee) {
                        next.set('assignee', assignee);
                    } else {
                        next.delete('assignee');
                    }
                    return next;
                },
                { replace: true }
            );
        },
        setPriority: (priority: null | string) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (priority) {
                        next.set('priority', priority);
                    } else {
                        next.delete('priority');
                    }
                    return next;
                },
                { replace: true }
            );
        },
        setStatus: (status: null | string) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (status) {
                        next.set('status', status);
                    } else {
                        next.delete('status');
                    }
                    return next;
                },
                { replace: true }
            );
        },
        setLabelId: (labelId: null | string) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (labelId) {
                        next.set('label', labelId);
                    } else {
                        next.delete('label');
                    }
                    return next;
                },
                { replace: true }
            );
        },
        setView: (view: TaskView) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (view === 'active') {
                        next.delete('view');
                    } else {
                        next.set('view', view);
                    }
                    return next;
                },
                { replace: true }
            );
        },
        setChatId: (chatId: string | null) => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    if (chatId) {
                        next.set('chat', chatId);
                    } else {
                        next.delete('chat');
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
