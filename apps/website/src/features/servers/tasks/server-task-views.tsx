import { Kanban, ListView } from '@heroui-pro/react';
import type { HostedTaskLabel } from '@tavern/api';
import * as React from 'react';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { LabelChip } from '../../tasks/label-chip.tsx';
import {
    taskPriorityLabels,
    taskStatusIcons,
    taskStatusLabels,
} from '../../tasks/task-presentation.ts';
import { ServerTaskActions } from './server-task-actions.tsx';
import { groupServerTasks, type ServerTask } from './server-task-presentation.ts';

interface ServerTaskViewProps {
    canAssign: boolean;
    labels: HostedTaskLabel[];
    onOpen: (task: ServerTask) => void;
    serverId: string;
    tasks: ServerTask[];
    viewerUserId: string;
}

export function ServerTasksBoard({
    canAssign,
    labels,
    onOpen,
    serverId,
    tasks,
    viewerUserId,
}: ServerTaskViewProps) {
    const groups = React.useMemo(() => groupServerTasks(tasks), [tasks]);

    return (
        <div className="min-h-0 flex-1 p-4">
            <Kanban>
                {groups.map((group) => (
                    <Kanban.Column key={group.status}>
                        <Kanban.ColumnHeader>
                            <Kanban.ColumnIndicator>
                                <Icon icon={taskStatusIcons[group.status]} />
                            </Kanban.ColumnIndicator>
                            <Kanban.ColumnTitle>
                                {taskStatusLabels[group.status]}
                            </Kanban.ColumnTitle>
                            <Kanban.ColumnCount>{group.tasks.length}</Kanban.ColumnCount>
                        </Kanban.ColumnHeader>
                        <Kanban.ColumnBody>
                            <Kanban.CardList
                                aria-label={`${taskStatusLabels[group.status]} tasks`}
                                items={group.tasks}
                                renderEmptyState={() =>
                                    `No ${taskStatusLabels[group.status].toLowerCase()} tasks.`
                                }
                            >
                                {(task) => (
                                    <Kanban.Card id={task.id} textValue={task.title}>
                                        <TaskSummary onOpen={onOpen} task={task} />
                                        <ServerTaskActions
                                            canAssign={canAssign}
                                            labels={labels}
                                            serverId={serverId}
                                            task={task}
                                            viewerUserId={viewerUserId}
                                        />
                                    </Kanban.Card>
                                )}
                            </Kanban.CardList>
                        </Kanban.ColumnBody>
                    </Kanban.Column>
                ))}
            </Kanban>
        </div>
    );
}

export function ServerTasksList({
    canAssign,
    labels,
    onOpen,
    serverId,
    tasks,
    viewerUserId,
}: ServerTaskViewProps) {
    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <div className="mx-auto max-w-5xl">
                <ListView aria-label="Tasks" items={tasks} variant="secondary">
                    {(task: ServerTask) => (
                        <ListView.Item id={task.id} textValue={task.title}>
                            <ListView.ItemContent>
                                <TaskSummary onOpen={onOpen} task={task} />
                            </ListView.ItemContent>
                            <ListView.ItemAction>
                                <ServerTaskActions
                                    canAssign={canAssign}
                                    labels={labels}
                                    serverId={serverId}
                                    task={task}
                                    viewerUserId={viewerUserId}
                                />
                            </ListView.ItemAction>
                        </ListView.Item>
                    )}
                </ListView>
            </div>
        </div>
    );
}

// The task's own open affordance. Board cards and list rows both carry inline
// controls, so opening stays on an explicit button rather than a row action.
function TaskSummary({ onOpen, task }: { onOpen: (task: ServerTask) => void; task: ServerTask }) {
    return (
        <button
            aria-label={`Open task #${task.number} ${task.title}`}
            className="block w-full min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => onOpen(task)}
            type="button"
        >
            <span className="block font-mono text-muted text-xs">
                #{task.number} · {task.chatLabel}
            </span>
            <span className="mt-1 block font-medium text-foreground text-sm">{task.title}</span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {task.labels.map((label) => (
                    <LabelChip color={label.color} key={label.id} name={label.name} />
                ))}
                {task.priority === 'none' ? null : (
                    <span className="text-muted text-xs">{taskPriorityLabels[task.priority]}</span>
                )}
                <span className="text-muted text-xs">{assigneeLabel(task)}</span>
                <span className="text-muted text-xs">
                    <RelativeTime value={task.updatedAt} />
                </span>
            </div>
        </button>
    );
}

function assigneeLabel(task: ServerTask) {
    if (task.assigneeAgentId) {
        return `Agent ${task.assigneeAgentId.slice(-6)}`;
    }
    if (task.assigneeUserId) {
        return `Human ${task.assigneeUserId.slice(-6)}`;
    }
    return 'Unassigned';
}
