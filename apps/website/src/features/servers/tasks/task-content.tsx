import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import { useServerContext } from '../server-context.ts';
import { filterTasks, type TaskItem, toTaskItem } from './task-model.ts';
import { TaskState } from './task-state.tsx';
import { useTaskView } from './task-view.ts';
import { TaskBoard, TaskList } from './task-views.tsx';

export function TaskContent({ onOpenTask }: { onOpenTask: (task: TaskItem) => void }) {
    const { server } = useServerContext();
    const agents = useAgents(server.id);
    const humans = useHumanDirectory(server.id);
    const { filters, layout } = useTaskView();
    const { assignee, chatId, labelId, priority, status, view } = filters;
    const tasksQuery = useTasks(server.id, chatId ?? undefined);
    const tasks = React.useMemo(
        () => tasksQuery.data?.map((item) => toTaskItem(item, humans, agents.data ?? [])) ?? [],
        [agents.data, humans, tasksQuery.data]
    );
    const filtered = React.useMemo(
        () => filterTasks(tasks, { assignee, labelId, priority, status, view }),
        [assignee, labelId, priority, status, tasks, view]
    );
    // The chat filter narrows the query itself, so a filtered-out chat comes
    // back with no tasks at all. Without this the page would claim the Server
    // has no tasks when it only has none matching. Every other filter runs
    // over `tasks` in memory, so an empty `tasks` means there is genuinely
    // nothing to filter — including under the default `active` lens, which is
    // the page's own standing view rather than something the reader set.
    const isFiltered = chatId !== null;

    if (tasksQuery.error) {
        return (
            <TaskState
                description={tasksQuery.error.message}
                title="Tasks unavailable"
                tone="error"
            />
        );
    }
    if (!tasksQuery.data) {
        return (
            <div aria-busy="true" className="min-h-0 flex-1">
                <span className="sr-only">Loading tasks</span>
            </div>
        );
    }
    if (tasks.length === 0 && !isFiltered) {
        return (
            <TaskState
                description="Create a task from a new message. Its Thread becomes the work surface."
                title="No tasks yet"
            />
        );
    }
    if (filtered.length === 0) {
        return (
            <TaskState description="Drop a filter to see more tasks." title="No matching tasks" />
        );
    }
    if (layout === 'board') {
        return <TaskBoard onOpenTask={onOpenTask} tasks={filtered} />;
    }
    return <TaskList onOpenTask={onOpenTask} tasks={filtered} />;
}
