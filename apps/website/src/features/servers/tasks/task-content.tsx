import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import { useHostedServerContext } from '../hosted-server-context.ts';
import { filterTasks, type TaskItem, toTaskItem } from './task-model.ts';
import { TaskState } from './task-state.tsx';
import { useTaskView } from './task-view.ts';
import { TaskBoard, TaskList } from './task-views.tsx';

export function TaskContent({
    chatId,
    onOpenTask,
}: {
    chatId?: string;
    onOpenTask: (task: TaskItem) => void;
}) {
    const { server } = useHostedServerContext();
    const agents = useAgents(server.id);
    const tasksQuery = useTasks(server.id, chatId);
    const humans = useHumanDirectory(server.id);
    const { filters, layout } = useTaskView();
    const { labelId, query, view } = filters;
    const tasks = React.useMemo(
        () => tasksQuery.data?.map((item) => toTaskItem(item, humans, agents.data ?? [])) ?? [],
        [agents.data, humans, tasksQuery.data]
    );
    const filtered = React.useMemo(
        () => filterTasks(tasks, { labelId, query, view }),
        [labelId, query, tasks, view]
    );

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
        return <TaskState description="Fetching the task snapshot." title="Loading tasks" />;
    }
    if (tasks.length === 0) {
        return (
            <TaskState
                description="Create a task from a new message. Its Thread becomes the work surface."
                title="No tasks yet"
            />
        );
    }
    if (filtered.length === 0) {
        return (
            <TaskState
                description="Change the view or search to see more tasks."
                title="No matching tasks"
            />
        );
    }
    if (layout === 'board') {
        return <TaskBoard onOpenTask={onOpenTask} tasks={filtered} />;
    }
    return <TaskList onOpenTask={onOpenTask} tasks={filtered} />;
}
