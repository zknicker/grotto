import { Alert, Button, SearchField, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import type { HostedChat } from '@tavern/api';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useServerTaskLabels } from '../../../hooks/servers/use-server-task-labels.ts';
import { useServerTasks } from '../../../hooks/servers/use-server-tasks.ts';
import { SectionHeader } from '../../shell/section-header.tsx';
import { NewServerTaskDialog } from './new-server-task-dialog.tsx';
import {
    filterServerTasks,
    type ServerTask,
    serverTaskChatOptions,
    toServerTask,
} from './server-task-presentation.ts';
import { ServerTasksBoard, ServerTasksList } from './server-task-views.tsx';
import { resolveTaskView } from './server-tasks-sidebar.tsx';

type ServerTaskMode = 'board' | 'list';

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
    const [searchParams] = useSearchParams();
    const [composeOpen, setComposeOpen] = React.useState(false);
    const [mode, setMode] = React.useState<ServerTaskMode>('board');
    const [query, setQuery] = React.useState('');
    // View and label filters live in the URL; the tasks sidebar owns them.
    const view = resolveTaskView(searchParams.get('view'));
    const labelId = searchParams.get('label');
    const tasks = React.useMemo(() => tasksQuery.data?.map(toServerTask) ?? [], [tasksQuery.data]);
    const filtered = React.useMemo(
        () => filterServerTasks(tasks, { labelId, query, view }),
        [labelId, query, tasks, view]
    );
    const chatOptions = React.useMemo(() => serverTaskChatOptions(chats), [chats]);
    const canAssign = role === 'owner' || role === 'admin';
    const labels = labelsQuery.data ?? [];

    return (
        <section aria-label="Server tasks" className="flex min-h-0 flex-1 flex-col">
            <SectionHeader title="Tasks">
                <SearchField
                    aria-label="Search tasks"
                    className="w-56"
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
                <Button
                    isDisabled={chatOptions.length === 0}
                    onPress={() => setComposeOpen(true)}
                    size="sm"
                >
                    New Task
                </Button>
            </SectionHeader>

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
