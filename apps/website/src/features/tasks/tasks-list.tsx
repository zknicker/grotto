import * as React from 'react';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { Checkbox } from '../../components/ui/checkbox.tsx';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelChip } from './label-chip.tsx';
import {
    formatTaskNumber,
    type TaskRecord,
    type TaskStatus,
    taskPriorityLabels,
    taskStatusIcons,
    taskStatusLabels,
} from './task-presentation.ts';

export type TaskSelectMode = 'range' | 'toggle';

interface TaskStatusGroupProps {
    agents: AgentSelectOption[];
    isSelected: (id: string) => boolean;
    onOpen: (task: TaskRecord) => void;
    onToggleSelect: (task: TaskRecord, mode: TaskSelectMode) => void;
    selectionActive: boolean;
    status: TaskStatus;
    tasks: TaskRecord[];
}

export function TaskStatusGroup({
    agents,
    isSelected,
    onOpen,
    onToggleSelect,
    selectionActive,
    status,
    tasks,
}: TaskStatusGroupProps) {
    return (
        <section>
            <div className="mx-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
                <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    icon={taskStatusIcons[status]}
                />
                <span className="font-medium text-foreground text-sm">
                    {taskStatusLabels[status]}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums">{tasks.length}</span>
            </div>
            <FluidList className="px-2 py-1" highlightClassName="rounded-lg">
                {tasks.map((task, index) => (
                    <FluidListItem index={index} key={task.id}>
                        <TaskRow
                            agents={agents}
                            onOpen={onOpen}
                            onToggleSelect={onToggleSelect}
                            selected={isSelected(task.id)}
                            selectionActive={selectionActive}
                            task={task}
                        />
                    </FluidListItem>
                ))}
            </FluidList>
        </section>
    );
}

function TaskRowAssignee({
    agents,
    assignee,
}: {
    agents: AgentSelectOption[];
    assignee: TaskRecord['assignee'];
}) {
    if (assignee === null) {
        return null;
    }

    if (assignee.kind === 'user') {
        return (
            <span className="hidden max-w-28 truncate text-meta text-muted-foreground md:inline">
                You
            </span>
        );
    }

    const agent = agents.find((candidate) => candidate.id === assignee.agentId);

    return (
        <span className="hidden max-w-32 text-meta text-muted-foreground md:flex md:min-w-0">
            {agent ? <AgentOptionLabel agent={agent} /> : <span>{assignee.agentId}</span>}
        </span>
    );
}

function TaskRow({
    agents,
    onOpen,
    onToggleSelect,
    selected,
    selectionActive,
    task,
}: {
    agents: AgentSelectOption[];
    onOpen: (task: TaskRecord) => void;
    onToggleSelect: (task: TaskRecord, mode: TaskSelectMode) => void;
    selected: boolean;
    selectionActive: boolean;
    task: TaskRecord;
}) {
    const handleClick = React.useCallback(
        (event: React.MouseEvent) => {
            if (event.metaKey || event.ctrlKey) {
                onToggleSelect(task, 'toggle');
                return;
            }

            if (event.shiftKey) {
                onToggleSelect(task, 'range');
                return;
            }

            onOpen(task);
        },
        [onOpen, onToggleSelect, task]
    );

    return (
        <div
            className={cn(
                'group/task-row relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm',
                selected ? 'bg-active' : null
            )}
        >
            <button
                aria-label={`Open ${formatTaskNumber(task)} ${task.title}`}
                className="no-drag absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-window-drag-disabled=""
                onClick={handleClick}
                type="button"
            />

            <span
                className={cn(
                    'relative z-20 flex w-5 shrink-0 items-center justify-center transition-opacity',
                    selected || selectionActive
                        ? 'opacity-100'
                        : 'opacity-0 focus-within:opacity-100 group-hover/task-row:opacity-100'
                )}
            >
                <Checkbox
                    aria-label={`Select ${formatTaskNumber(task)}`}
                    checked={selected}
                    // The invisible after-box widens the hit target to the row
                    // height so a near-miss selects instead of opening.
                    className="relative size-4 after:absolute after:-inset-x-3 after:-inset-y-3.5 after:content-['']"
                    onCheckedChange={() => onToggleSelect(task, 'toggle')}
                />
            </span>

            <span className="pointer-events-none relative z-10 flex w-12 shrink-0 items-center gap-1.5 font-mono text-caption text-muted-foreground tabular-nums">
                {formatTaskNumber(task)}
            </span>

            <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="min-w-0 truncate font-medium text-base text-foreground">
                    {task.title}
                </span>
                {task.labels.map((label) => (
                    <LabelChip color={label.color} key={label.id} name={label.name} />
                ))}
            </div>

            <div className="pointer-events-none relative z-10 ml-auto flex shrink-0 items-center gap-2">
                {task.priority !== 'none' ? (
                    <span className="hidden text-meta text-muted-foreground sm:inline">
                        {taskPriorityLabels[task.priority]}
                    </span>
                ) : null}
                <TaskRowAssignee agents={agents} assignee={task.assignee} />
                <span className="hidden w-16 text-right text-meta text-muted-foreground sm:inline">
                    <RelativeTime value={task.updatedAt} />
                </span>
            </div>
        </div>
    );
}
