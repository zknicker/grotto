import { Alert, Button, SearchField, Tabs, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import type { HostedChat } from '@tavern/api';
import * as React from 'react';
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
    { label: 'All', value: 'all' },
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
            <header className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-separator border-b px-3 py-1.5">
                <Tabs
                    onSelectionChange={(value) => setView(String(value) as ServerTaskView)}
                    selectedKey={view}
                    variant="secondary"
                >
                    <Tabs.ListContainer>
                        <Tabs.List aria-label="Task views">
                            {viewOptions.map((option) => (
                                <Tabs.Tab id={option.value} key={option.value}>
                                    {option.label}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
                <SearchField
                    aria-label="Search tasks"
                    className="min-w-48 flex-1"
                    onChange={setQuery}
                    value={query}
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Search tasks..." />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                <ToggleButtonGroup
                    aria-label="Task layout"
                    disallowEmptySelection
                    onSelectionChange={(keys) => {
                        const [next] = [...keys];
                        if (next === 'board' || next === 'list') {
                            setMode(next);
                        }
                    }}
                    selectedKeys={[mode]}
                    selectionMode="single"
                    size="sm"
                >
                    <ToggleButton id="board">Board</ToggleButton>
                    <ToggleButton id="list">List</ToggleButton>
                </ToggleButtonGroup>
                <Button onPress={() => setLabelsOpen(true)} size="sm" variant="secondary">
                    Task Labels
                </Button>
                <Button
                    isDisabled={chatOptions.length === 0}
                    onPress={() => setComposeOpen(true)}
                    size="sm"
                >
                    New Task
                </Button>
            </header>

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

// The board's non-task states. A lost snapshot is an alert, not an empty
// board — the operator must be able to tell "no tasks" from "no access".
export function ServerTaskState({
    description,
    title,
    tone = 'muted',
}: {
    description: string;
    title: string;
    tone?: 'error' | 'muted';
}) {
    if (tone === 'error') {
        return (
            <div className="flex flex-1 items-center justify-center p-6">
                <Alert role="alert" status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>{title}</Alert.Title>
                        <Alert.Description>{description}</Alert.Description>
                    </Alert.Content>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState>
                <EmptyState.Header>
                    <EmptyState.Title>{title}</EmptyState.Title>
                    <EmptyState.Description>{description}</EmptyState.Description>
                </EmptyState.Header>
            </EmptyState>
        </div>
    );
}
