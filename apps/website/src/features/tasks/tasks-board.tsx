import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelChip } from './label-chip.tsx';
import {
    formatTaskNumber,
    type TaskRecord,
    type TaskStatus,
    taskStatusIcons,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';
import { TaskStatusMenu, TaskStatusPill } from './task-status-menu.tsx';

// The board lays every status out as a column — including empty ones, so the
// full lifecycle is always visible. Terminal columns (done, closed) start
// collapsed to keep the active work in view.
export function TasksBoard({
    agents,
    onOpen,
    tasks,
}: {
    agents: AgentSelectOption[];
    onOpen: (task: TaskRecord) => void;
    tasks: TaskRecord[];
}) {
    const byStatus = React.useMemo(() => {
        const groups = new Map<TaskStatus, TaskRecord[]>(
            taskStatusOrder.map((status) => [status, []])
        );
        for (const task of tasks) {
            groups.get(task.status)?.push(task);
        }
        return groups;
    }, [tasks]);

    return (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
            {taskStatusOrder.map((status) => (
                <TaskBoardColumn
                    agents={agents}
                    defaultCollapsed={status === 'done' || status === 'closed'}
                    key={status}
                    onOpen={onOpen}
                    status={status}
                    tasks={byStatus.get(status) ?? []}
                />
            ))}
        </div>
    );
}

function TaskBoardColumn({
    agents,
    defaultCollapsed,
    onOpen,
    status,
    tasks,
}: {
    agents: AgentSelectOption[];
    defaultCollapsed: boolean;
    onOpen: (task: TaskRecord) => void;
    status: TaskStatus;
    tasks: TaskRecord[];
}) {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

    return (
        <section className="flex w-72 shrink-0 flex-col">
            <button
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setCollapsed((value) => !value)}
                type="button"
            >
                <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
                />
                <TaskStatusPill status={status} />
                <span className="text-muted-foreground text-sm tabular-nums">{tasks.length}</span>
            </button>
            {collapsed ? null : (
                <div className="mt-2 flex flex-col gap-2">
                    {tasks.length > 0 ? (
                        tasks.map((task) => (
                            <TaskBoardCard
                                agents={agents}
                                key={task.id}
                                onOpen={onOpen}
                                task={task}
                            />
                        ))
                    ) : (
                        <div className="rounded-lg border border-border-subtle border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
                            No {taskStatusLabels[status].toLowerCase()} tasks.
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function TaskBoardCard({
    agents,
    onOpen,
    task,
}: {
    agents: AgentSelectOption[];
    onOpen: (task: TaskRecord) => void;
    task: TaskRecord;
}) {
    const assignee = task.assignee;
    const agent =
        assignee?.kind === 'agent'
            ? agents.find((candidate) => candidate.id === assignee.agentId)
            : null;

    return (
        <Elevated className="relative rounded-lg border p-3" offset={1}>
            <button
                aria-label={`Open ${formatTaskNumber(task)} ${task.title}`}
                className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onOpen(task)}
                type="button"
            />
            <span className="pointer-events-none relative z-10 flex items-center gap-1.5">
                <Icon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                    icon={taskStatusIcons[task.status]}
                />
                <span className="font-mono text-caption text-muted-foreground tabular-nums">
                    {formatTaskNumber(task)}
                </span>
            </span>
            <p className="pointer-events-none relative z-10 mt-1 font-medium text-base text-foreground">
                {task.title}
            </p>
            <div className="pointer-events-none relative z-10 mt-2 flex flex-wrap items-center gap-1.5">
                {task.labels.map((label) => (
                    <LabelChip color={label.color} key={label.id} name={label.name} />
                ))}
            </div>
            <div className="relative z-20 mt-2 flex items-center justify-between">
                <span className="min-w-0 text-meta text-muted-foreground">
                    {task.assignee === null ? null : agent ? (
                        <AgentOptionLabel agent={agent} />
                    ) : task.assignee.kind === 'user' ? (
                        'You'
                    ) : (
                        task.assignee.agentId
                    )}
                </span>
                <TaskStatusMenu
                    ariaLabel={`Change status for task ${formatTaskNumber(task)}`}
                    messageId={task.id}
                    status={task.status}
                />
            </div>
        </Elevated>
    );
}
