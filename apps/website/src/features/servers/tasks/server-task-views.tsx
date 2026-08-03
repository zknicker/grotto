import { Kanban } from '@heroui-pro/react';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
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
import { useServerAssigneeName } from './use-server-assignee-name.ts';

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
    const assigneeName = useServerAssigneeName(serverId);

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
                                        <TaskSummary
                                            assigneeLabel={assigneeName(task)}
                                            onOpen={onOpen}
                                            task={task}
                                        />
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

/**
 * Linear-style grouped list: collapsible status groups with dense
 * display-only rows; opening the task is the row action, and metadata
 * edits live on the board cards and the task thread.
 */
export function ServerTasksList({ onOpen, serverId, tasks }: ServerTaskViewProps) {
    const groups = React.useMemo(
        () => groupServerTasks(tasks).filter((group) => group.tasks.length > 0),
        [tasks]
    );
    const assigneeName = useServerAssigneeName(serverId);

    return (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
            {groups.map((group) => (
                <TaskListGroup
                    assigneeName={assigneeName}
                    key={group.status}
                    onOpen={onOpen}
                    status={group.status}
                    tasks={group.tasks}
                />
            ))}
        </div>
    );
}

function TaskListGroup({
    assigneeName,
    onOpen,
    status,
    tasks,
}: {
    assigneeName: (task: ServerTask) => string;
    onOpen: (task: ServerTask) => void;
    status: ServerTask['status'];
    tasks: ServerTask[];
}) {
    const [open, setOpen] = React.useState(true);

    return (
        <section>
            <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-separator border-b bg-background/80 px-3 backdrop-blur">
                <button
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 cursor-[var(--cursor-interactive)] items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    onClick={() => setOpen((value) => !value)}
                    type="button"
                >
                    <Icon
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted transition-transform duration-150"
                        icon={ArrowRight01Icon}
                        style={{ transform: open ? 'rotate(90deg)' : 'none' }}
                    />
                    <Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted"
                        icon={taskStatusIcons[status]}
                    />
                    <span className="font-semibold text-foreground text-sm">
                        {taskStatusLabels[status]}
                    </span>
                    <span className="text-muted text-xs tabular-nums">{tasks.length}</span>
                </button>
            </div>
            <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
            >
                <div className="overflow-hidden">
                    <div className="divide-y divide-separator">
                        {tasks.map((task) => (
                            <TaskListRow
                                assigneeLabel={assigneeName(task)}
                                key={task.id}
                                onOpen={onOpen}
                                task={task}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function TaskListRow({
    assigneeLabel,
    onOpen,
    task,
}: {
    assigneeLabel: string;
    onOpen: (task: ServerTask) => void;
    task: ServerTask;
}) {
    return (
        <button
            aria-label={`Open task #${task.number} ${task.title}`}
            className="flex h-9 w-full cursor-[var(--cursor-interactive)] items-center gap-2 px-3 text-left outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            onClick={() => onOpen(task)}
            type="button"
        >
            <span className="w-10 shrink-0 text-right font-mono text-muted text-xs tabular-nums">
                #{task.number}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground text-sm">{task.title}</span>
            <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                {task.labels.map((label) => (
                    <LabelChip color={label.color} key={label.id} name={label.name} />
                ))}
                {task.priority === 'none' ? null : (
                    <span className="text-muted text-xs">{taskPriorityLabels[task.priority]}</span>
                )}
                <span className="text-muted text-xs">{task.chatLabel}</span>
            </div>
            <span className="hidden shrink-0 text-muted text-xs tabular-nums sm:inline">
                <RelativeTime value={task.updatedAt} />
            </span>
            <span className="w-24 shrink-0 truncate text-right text-muted text-xs">
                {assigneeLabel}
            </span>
        </button>
    );
}

// The task's own open affordance. Board cards and list rows both carry inline
// controls, so opening stays on an explicit button rather than a row action.
function TaskSummary({
    assigneeLabel,
    onOpen,
    task,
}: {
    assigneeLabel: string;
    onOpen: (task: ServerTask) => void;
    task: ServerTask;
}) {
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
                <span className="text-muted text-xs">{assigneeLabel}</span>
                <span className="text-muted text-xs">
                    <RelativeTime value={task.updatedAt} />
                </span>
            </div>
        </button>
    );
}
