import { Kanban } from '@heroui-pro/react';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { LabelChip } from '../../tasks/label-chip.tsx';
import { taskPriorityLabels, taskStatusLabels } from '../../tasks/task-presentation.ts';
import { TaskStatusDisc } from '../../tasks/task-status-disc.tsx';
import { TaskActions } from './task-actions.tsx';
import { groupTasks, type TaskItem } from './task-model.ts';

interface TaskViewProps {
    onOpenTask: (task: TaskItem) => void;
    tasks: TaskItem[];
}

export function TaskBoard({ onOpenTask, tasks }: TaskViewProps) {
    const groups = React.useMemo(() => groupTasks(tasks), [tasks]);

    return (
        <div className="min-h-0 flex-1 p-4">
            <Kanban>
                {groups.map((group) => (
                    <Kanban.Column key={group.status}>
                        <Kanban.ColumnHeader>
                            <Kanban.ColumnIndicator>
                                <TaskStatusDisc className="size-4" status={group.status} />
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
                                            assigneeLabel={task.assigneeLabel}
                                            onOpen={onOpenTask}
                                            task={task}
                                        />
                                        <TaskActions task={task} />
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
export function TaskList({ onOpenTask, tasks }: TaskViewProps) {
    const groups = React.useMemo(
        () => groupTasks(tasks).filter((group) => group.tasks.length > 0),
        [tasks]
    );

    return (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
            {groups.map((group) => (
                <TaskListGroup
                    key={group.status}
                    onOpen={onOpenTask}
                    status={group.status}
                    tasks={group.tasks}
                />
            ))}
        </div>
    );
}

function TaskListGroup({
    onOpen,
    status,
    tasks,
}: {
    onOpen: (task: TaskItem) => void;
    status: TaskItem['status'];
    tasks: TaskItem[];
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
                    <TaskStatusDisc className="size-4" status={status} />
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
                                assigneeLabel={task.assigneeLabel}
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
    onOpen: (task: TaskItem) => void;
    task: TaskItem;
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
    onOpen: (task: TaskItem) => void;
    task: TaskItem;
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
