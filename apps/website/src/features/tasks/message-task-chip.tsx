import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import {
    formatTaskNumber,
    type TaskStatus,
    taskStatusClasses,
    taskStatusIcons,
} from './task-presentation.ts';

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

    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-xs',
                taskStatusClasses[task.status]
            )}
            data-testid="message-task-badge"
        >
            <Icon className="size-3.5" icon={taskStatusIcons[task.status]} />
            {formatTaskNumber(task)}
            {assigneeLabel ? ` ${assigneeLabel}` : ''}
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
