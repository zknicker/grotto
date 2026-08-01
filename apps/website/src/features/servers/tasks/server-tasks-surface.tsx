import { Alert, Button, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import type { HostedChat } from '@tavern/api';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useServerTaskLabels } from '../../../hooks/servers/use-server-task-labels.ts';
import { useServerTasks } from '../../../hooks/servers/use-server-tasks.ts';
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

interface ServerTasksContextValue {
    canAssign: boolean;
    composeDisabled: boolean;
    error: string | null;
    filtered: ServerTask[];
    labels: NonNullable<ReturnType<typeof useServerTaskLabels>['data']>;
    loaded: boolean;
    mode: ServerTaskMode;
    onOpenTask: (task: ServerTask) => void;
    openCompose: () => void;
    serverId: string;
    setMode: (mode: ServerTaskMode) => void;
    taskCount: number;
    viewerUserId: string;
}

const ServerTasksContext = React.createContext<ServerTasksContextValue | null>(null);

function useServerTasksContext() {
    const context = React.use(ServerTasksContext);
    if (!context) {
        throw new Error('ServerTasks parts must render inside ServerTasksProvider.');
    }
    return context;
}

/**
 * Owns the tasks surface state: queries, board/list mode, URL filters, and
 * the compose dialog. Compose the header controls and body wherever the
 * host surface wants them — the tasks page puts the controls in the shell
 * topbar, the chat Tasks tab in a local band.
 */
export function ServerTasksProvider({
    chats,
    children,
    onOpenTask,
    role,
    serverId,
    viewerUserId,
}: {
    chats: HostedChat[];
    children: React.ReactNode;
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
    // View, label, and search filters live in the URL; the tasks sidebar owns them.
    const view = resolveTaskView(searchParams.get('view'));
    const labelId = searchParams.get('label');
    const query = searchParams.get('q') ?? '';
    const tasks = React.useMemo(() => tasksQuery.data?.map(toServerTask) ?? [], [tasksQuery.data]);
    const filtered = React.useMemo(
        () => filterServerTasks(tasks, { labelId, query, view }),
        [labelId, query, tasks, view]
    );
    const chatOptions = React.useMemo(() => serverTaskChatOptions(chats), [chats]);
    const value = React.useMemo<ServerTasksContextValue>(
        () => ({
            canAssign: role === 'owner' || role === 'admin',
            composeDisabled: chatOptions.length === 0,
            error: tasksQuery.error?.message ?? null,
            filtered,
            labels: labelsQuery.data ?? [],
            loaded: tasksQuery.data !== undefined,
            mode,
            onOpenTask,
            openCompose: () => setComposeOpen(true),
            serverId,
            setMode,
            taskCount: tasks.length,
            viewerUserId,
        }),
        [
            chatOptions.length,
            filtered,
            labelsQuery.data,
            mode,
            onOpenTask,
            role,
            serverId,
            tasks.length,
            tasksQuery.data,
            tasksQuery.error?.message,
            viewerUserId,
        ]
    );

    return (
        <ServerTasksContext value={value}>
            {children}
            <NewServerTaskDialog
                chats={chatOptions}
                onOpenChange={setComposeOpen}
                open={composeOpen}
                serverId={serverId}
            />
        </ServerTasksContext>
    );
}

/** Board/List switch and the New Task button, for the host's topbar. */
export function ServerTasksHeaderControls() {
    const { composeDisabled, mode, openCompose, setMode } = useServerTasksContext();

    return (
        <>
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
            <Button isDisabled={composeDisabled} onPress={openCompose} size="sm">
                New Task
            </Button>
        </>
    );
}

/** The task board/list body with its loading, empty, and error states. */
export function ServerTasksBody() {
    const {
        canAssign,
        error,
        filtered,
        labels,
        loaded,
        mode,
        onOpenTask,
        serverId,
        taskCount,
        viewerUserId,
    } = useServerTasksContext();

    if (error) {
        return <ServerTaskState description={error} title="Tasks unavailable" tone="error" />;
    }
    if (!loaded) {
        return (
            <ServerTaskState
                description="Fetching the Server task snapshot."
                title="Loading tasks"
            />
        );
    }
    if (taskCount === 0) {
        return (
            <ServerTaskState
                description="Create a task from a new message. Its Thread becomes the work surface."
                title="No tasks yet"
            />
        );
    }
    if (filtered.length === 0) {
        return (
            <ServerTaskState
                description="Change the view or search to see more tasks."
                title="No matching tasks"
            />
        );
    }
    if (mode === 'board') {
        return (
            <ServerTasksBoard
                canAssign={canAssign}
                labels={labels}
                onOpen={onOpenTask}
                serverId={serverId}
                tasks={filtered}
                viewerUserId={viewerUserId}
            />
        );
    }
    return (
        <ServerTasksList
            canAssign={canAssign}
            labels={labels}
            onOpen={onOpenTask}
            serverId={serverId}
            tasks={filtered}
            viewerUserId={viewerUserId}
        />
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
