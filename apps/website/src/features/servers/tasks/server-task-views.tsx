import type { HostedTaskLabel } from '@tavern/api';
import * as React from 'react';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { Elevated } from '../../../components/ui/surface.tsx';
import { LabelChip } from '../../tasks/label-chip.tsx';
import { taskPriorityLabels, taskStatusLabels } from '../../tasks/task-presentation.ts';
import { TaskStatusPill } from '../../tasks/task-status-menu.tsx';
import { ServerTaskActions } from './server-task-actions.tsx';
import { groupServerTasks, type ServerTask } from './server-task-presentation.ts';

export function ServerTasksBoard({
    canAssign,
    labels,
    onOpen,
    serverId,
    tasks,
    viewerUserId,
}: {
    canAssign: boolean;
    labels: HostedTaskLabel[];
    onOpen: (task: ServerTask) => void;
    serverId: string;
    tasks: ServerTask[];
    viewerUserId: string;
}) {
    const groups = React.useMemo(() => groupServerTasks(tasks), [tasks]);

    return (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
            {groups.map((group) => (
                <section className="flex w-72 shrink-0 flex-col" key={group.status}>
                    <div className="flex items-center gap-2 px-1.5 py-1">
                        <TaskStatusPill status={group.status} />
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {group.tasks.length}
                        </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {group.tasks.length > 0 ? (
                            group.tasks.map((task) => (
                                <ServerTaskCard
                                    canAssign={canAssign}
                                    key={task.id}
                                    labels={labels}
                                    onOpen={onOpen}
                                    serverId={serverId}
                                    task={task}
                                    viewerUserId={viewerUserId}
                                />
                            ))
                        ) : (
                            <div className="rounded-lg border border-border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
                                No {taskStatusLabels[group.status].toLowerCase()} tasks.
                            </div>
                        )}
                    </div>
                </section>
            ))}
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
}: {
    canAssign: boolean;
    labels: HostedTaskLabel[];
    onOpen: (task: ServerTask) => void;
    serverId: string;
    tasks: ServerTask[];
    viewerUserId: string;
}) {
    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-2">
                {tasks.map((task) => (
                    <Elevated
                        className="relative grid gap-3 rounded-lg p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                        key={task.id}
                        offset={1}
                    >
                        <TaskSummary onOpen={onOpen} task={task} />
                        <ServerTaskActions
                            canAssign={canAssign}
                            labels={labels}
                            serverId={serverId}
                            task={task}
                            viewerUserId={viewerUserId}
                        />
                    </Elevated>
                ))}
            </div>
        </div>
    );
}

function ServerTaskCard({
    canAssign,
    labels,
    onOpen,
    serverId,
    task,
    viewerUserId,
}: {
    canAssign: boolean;
    labels: HostedTaskLabel[];
    onOpen: (task: ServerTask) => void;
    serverId: string;
    task: ServerTask;
    viewerUserId: string;
}) {
    return (
        <Elevated className="relative rounded-lg p-3" offset={1}>
            <TaskSummary onOpen={onOpen} task={task} />
            <div className="mt-3">
                <ServerTaskActions
                    canAssign={canAssign}
                    labels={labels}
                    serverId={serverId}
                    task={task}
                    viewerUserId={viewerUserId}
                />
            </div>
        </Elevated>
    );
}

function TaskSummary({ onOpen, task }: { onOpen: (task: ServerTask) => void; task: ServerTask }) {
    return (
        <button
            aria-label={`Open task #${task.number} ${task.title}`}
            className="block w-full min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpen(task)}
            type="button"
        >
            <p className="font-mono text-muted-foreground text-xs">
                #{task.number} · {task.chatLabel}
            </p>
            <p className="mt-1 font-medium text-foreground">{task.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {task.labels.map((label) => (
                    <LabelChip color={label.color} key={label.id} name={label.name} />
                ))}
                {task.priority === 'none' ? null : (
                    <span className="text-muted-foreground text-xs">
                        {taskPriorityLabels[task.priority]}
                    </span>
                )}
                {task.assigneeAgentId ? (
                    <span className="text-muted-foreground text-xs">
                        Agent {task.assigneeAgentId.slice(-6)}
                    </span>
                ) : task.assigneeUserId ? (
                    <span className="text-muted-foreground text-xs">
                        Human {task.assigneeUserId.slice(-6)}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">Unassigned</span>
                )}
                <span className="text-muted-foreground text-xs">
                    <RelativeTime value={task.updatedAt} />
                </span>
            </div>
        </button>
    );
}
