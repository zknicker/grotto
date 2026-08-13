import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { formatTaskNumber, type TaskStatus } from './task-presentation.ts';
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

export interface MessageTaskAssigneeProfile {
    avatarUrl: string | null;
    name: string;
}

export function MessageTaskChip({
    assigneeProfile,
    task,
}: {
    assigneeProfile?: MessageTaskAssigneeProfile | null;
    task: MessageTask;
}) {
    const assigneeLabel = messageTaskAssigneeLabel(task);
    const ownerName = assigneeProfile?.name ?? assigneeLabel;

    return (
        <span
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-muted"
            data-testid="message-task-badge"
        >
            <span className="shrink-0 tabular-nums">Task {formatTaskNumber(task)}</span>
            <TaskStatusDisc className="size-3.5" status={task.status} />
            {ownerName ? (
                <span className="flex min-w-0 items-center gap-1.5">
                    {assigneeProfile ? (
                        <EntityAvatar
                            name={assigneeProfile.name}
                            size={14}
                            src={assigneeProfile.avatarUrl}
                        />
                    ) : null}
                    <span className="truncate">{ownerName}</span>
                </span>
            ) : null}
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
