import type { HostedChat } from '@tavern/api';
import * as React from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { useServerTaskLabels } from '../../../hooks/servers/use-server-task-labels.ts';
import { useServerTasks } from '../../../hooks/servers/use-server-tasks.ts';
import { NewServerTaskDialog } from './new-server-task-dialog.tsx';
import { ServerTaskLabelsDialog } from './server-task-labels-dialog.tsx';
import {
    filterServerTasks,
    type ServerTask,
    type ServerTaskView,
    serverTaskChatOptions,
    toServerTask,
} from './server-task-presentation.ts';
import { ServerTasksBoard, ServerTasksList } from './server-task-views.tsx';

type ServerTaskMode = 'board' | 'list';

const viewOptions: Array<{ label: string; value: ServerTaskView }> = [
    { label: 'All tasks', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Unassigned', value: 'unassigned' },
];

export function ServerTasksSurface({
    chats,
    onOpenTask,
    role,
    serverId,
    viewerUserId,
}: {
    chats: HostedChat[];
    onOpenTask: (task: ServerTask) => void;
    role: 'admin' | 'member' | 'owner';
    serverId: string;
    viewerUserId: string;
}) {
    const tasksQuery = useServerTasks(serverId);
    const labelsQuery = useServerTaskLabels(serverId);
    const [composeOpen, setComposeOpen] = React.useState(false);
    const [labelsOpen, setLabelsOpen] = React.useState(false);
    const [mode, setMode] = React.useState<ServerTaskMode>('board');
    const [query, setQuery] = React.useState('');
    const [view, setView] = React.useState<ServerTaskView>('all');
    const tasks = React.useMemo(() => tasksQuery.data?.map(toServerTask) ?? [], [tasksQuery.data]);
    const filtered = React.useMemo(
        () => filterServerTasks(tasks, { query, view }),
        [query, tasks, view]
    );
    const chatOptions = React.useMemo(() => serverTaskChatOptions(chats), [chats]);
    const canAssign = role === 'owner' || role === 'admin';
    const labels = labelsQuery.data ?? [];

    return (
        <section aria-label="Server tasks" className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-border border-b px-4 py-3">
                <nav aria-label="Task views" className="flex items-center gap-1">
                    {viewOptions.map((option) => (
                        <Button
                            key={option.value}
                            onClick={() => setView(option.value)}
                            size="sm"
                            variant={view === option.value ? 'secondary' : 'ghost'}
                        >
                            {option.label}
                        </Button>
                    ))}
                </nav>
                <Input
                    aria-label="Search tasks"
                    className="min-w-48 flex-1"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tasks"
                    size="sm"
                    type="search"
                    value={query}
                />
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                    {(['board', 'list'] as const).map((option) => (
                        <Button
                            aria-pressed={mode === option}
                            key={option}
                            onClick={() => setMode(option)}
                            size="xs"
                            variant={mode === option ? 'secondary' : 'ghost'}
                        >
                            {option === 'board' ? 'Board' : 'List'}
                        </Button>
                    ))}
                </div>
                <Button onClick={() => setLabelsOpen(true)} size="sm" variant="secondary">
                    Task labels
                </Button>
                <Button
                    disabled={chatOptions.length === 0}
                    onClick={() => setComposeOpen(true)}
                    size="sm"
                >
                    New task
                </Button>
            </div>

            {tasksQuery.error ? (
                <ServerTaskState
                    description={tasksQuery.error.message}
                    title="Tasks unavailable"
                    tone="error"
                />
            ) : tasksQuery.data === undefined ? (
                <ServerTaskState
                    description="Fetching the Server task snapshot."
                    title="Loading tasks"
                />
            ) : tasks.length === 0 ? (
                <ServerTaskState
                    description="Create a task from a new message. Its Thread becomes the work surface."
                    title="No tasks yet"
                />
            ) : filtered.length === 0 ? (
                <ServerTaskState
                    description="Change the view or search to see more tasks."
                    title="No matching tasks"
                />
            ) : mode === 'board' ? (
                <ServerTasksBoard
                    canAssign={canAssign}
                    labels={labels}
                    onOpen={onOpenTask}
                    serverId={serverId}
                    tasks={filtered}
                    viewerUserId={viewerUserId}
                />
            ) : (
                <ServerTasksList
                    canAssign={canAssign}
                    labels={labels}
                    onOpen={onOpenTask}
                    serverId={serverId}
                    tasks={filtered}
                    viewerUserId={viewerUserId}
                />
            )}

            <NewServerTaskDialog
                chats={chatOptions}
                onOpenChange={setComposeOpen}
                open={composeOpen}
                serverId={serverId}
            />
            <ServerTaskLabelsDialog
                canManage={canAssign}
                labels={labels}
                onOpenChange={setLabelsOpen}
                open={labelsOpen}
                serverId={serverId}
            />
        </section>
    );
}

export function ServerTaskState({
    description,
    title,
    tone = 'muted',
}: {
    description: string;
    title: string;
    tone?: 'error' | 'muted';
}) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
            <h2 className="font-medium text-foreground">{title}</h2>
            <p
                className={
                    tone === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'
                }
            >
                {description}
            </p>
        </div>
    );
}
