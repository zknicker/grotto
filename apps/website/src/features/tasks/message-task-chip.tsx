import { cn } from '../../lib/utils.ts';
import { formatTaskNumber, type TaskStatus, taskStatusClasses } from './task-presentation.ts';
import { TaskStatusDisc } from './task-status-disc.tsx';

export interface MessageTask {
    assignee: {
        handle: string | null;
        id: string;
        kind?: 'agent' | 'human';
    } | null;
    number: number;
    status: TaskStatus;
}

export function MessageTaskChip({ task }: { task: MessageTask }) {
    const assigneeLabel = messageTaskAssigneeLabel(task);

    // Tinted fill frames the status hue (the label fg tokens read too heavy
    // floating on a neutral chip); the disc inherits the same hue.
    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs',
                taskStatusClasses[task.status]
            )}
            data-testid="message-task-badge"
        >
            <TaskStatusDisc className="size-3.5" status={task.status} />
            <span className="font-medium tabular-nums">{formatTaskNumber(task)}</span>
            {assigneeLabel ? <span className="opacity-80">{assigneeLabel}</span> : null}
        </span>
    );
}

export function messageTaskAssigneeLabel(task: MessageTask) {
    if (!task.assignee) {
        return null;
    }
    if (task.assignee.handle) {
        return `@${task.assignee.handle}`;
    }
    return task.assignee.kind === 'human' ? `Human ${task.assignee.id.slice(-6)}` : null;
}
