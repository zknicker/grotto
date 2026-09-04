import { ArrowUpRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { CursorHoverCard } from '../../../components/ui/cursor-hover-card.tsx';
import { EntityAvatar, identityMarkRadius } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    formatTaskNumber,
    type MessageTask,
    messageTaskAssigneeLabel,
    taskStatusLabels,
} from '../../tasks/task-presentation.ts';
import { TaskStatusDisc } from '../../tasks/task-status-disc.tsx';

export interface MessageTaskAssigneeProfile {
    avatarUrl: string | null;
    name: string;
}

/**
 * This message is a task, in the message header beside the author's name.
 *
 * Task identity is a fact about the message, not about its Thread, so it sits
 * in the same header slot as the automation and session marks rather than in
 * the Thread preview below — which then follows the ordinary Thread rule and
 * appears only once someone has replied. Number, status disc, and assignee
 * keep the order they have everywhere else: the number owns the left edge and
 * only the disc carries lifecycle colour.
 */
export function MessageTaskMark({
    assigneeProfile,
    onOpenThread,
    task,
}: {
    assigneeProfile?: MessageTaskAssigneeProfile | null;
    /** Absent on surfaces with no Thread affordance; the mark stays static. */
    onOpenThread?: () => void;
    task: MessageTask;
}) {
    const ownerName = assigneeProfile?.name ?? messageTaskAssigneeLabel(task);
    const face = (
        <MessageTaskMarkFace assigneeProfile={assigneeProfile} ownerName={ownerName} task={task} />
    );

    return (
        <CursorHoverCard
            className="w-72"
            content={
                <MessageTaskHoverContent
                    assigneeProfile={assigneeProfile}
                    onOpenThread={onOpenThread}
                    ownerName={ownerName}
                    task={task}
                />
            }
            triggerClassName="min-w-0"
        >
            {onOpenThread ? (
                <button
                    aria-label={messageTaskMarkLabel(task, ownerName)}
                    className="flex min-w-0 cursor-(--cursor-interactive) rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    onClick={onOpenThread}
                    type="button"
                >
                    {face}
                </button>
            ) : (
                face
            )}
        </CursorHoverCard>
    );
}

export function messageTaskMarkLabel(task: MessageTask, ownerName: null | string) {
    return `Task ${formatTaskNumber(task)} — ${taskStatusLabels[task.status]}${
        ownerName ? `, ${ownerName}` : ''
    }. Open thread`;
}

/**
 * The mark's own line. Header scale, so it sits with the name and the time
 * rather than with the message body.
 */
function MessageTaskMarkFace({
    assigneeProfile,
    ownerName,
    task,
}: {
    assigneeProfile?: MessageTaskAssigneeProfile | null;
    ownerName: null | string;
    task: MessageTask;
}) {
    return (
        <span
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-muted text-xs leading-5"
            data-testid="message-task-mark"
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

/**
 * What the mark cannot say at header scale: the status spelled out, the
 * assignee named, and the way into the work surface. Same shape as the
 * automation and session hover cards so the three read as one family.
 */
export function MessageTaskHoverContent({
    assigneeProfile,
    onOpenThread,
    ownerName,
    task,
}: {
    assigneeProfile?: MessageTaskAssigneeProfile | null;
    onOpenThread?: () => void;
    ownerName: null | string;
    task: MessageTask;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <header className="flex min-w-0 items-center gap-2.5">
                <TaskStatusDiscBox status={task.status} />
                <strong className="min-w-0 truncate font-semibold text-foreground text-sm">
                    Task {formatTaskNumber(task)}
                </strong>
            </header>
            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <div className="contents">
                    <dt className="text-muted">Status</dt>
                    <dd className="m-0 min-w-0 text-foreground">{taskStatusLabels[task.status]}</dd>
                </div>
                <div className="contents">
                    <dt className="text-muted">Assignee</dt>
                    <dd className="m-0 flex min-w-0 items-center gap-1.5 text-foreground">
                        {assigneeProfile ? (
                            <EntityAvatar
                                name={assigneeProfile.name}
                                size={16}
                                src={assigneeProfile.avatarUrl}
                            />
                        ) : null}
                        <span className="min-w-0 truncate">{ownerName ?? 'Unassigned'}</span>
                    </dd>
                </div>
            </dl>
            {onOpenThread ? (
                <div className="border-separator border-t pt-3">
                    <button
                        className="inline-flex w-fit cursor-(--cursor-interactive) items-center gap-1 rounded-md font-semibold text-accent text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        onClick={onOpenThread}
                        type="button"
                    >
                        Open thread
                        <Icon aria-hidden="true" icon={ArrowUpRight01Icon} size={11} />
                    </button>
                </div>
            ) : null}
        </div>
    );
}

/** Exact box, so it derives its radius the way every fixed identity mark does. */
function TaskStatusDiscBox({ status }: { status: MessageTask['status'] }) {
    return (
        <span
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center bg-surface-tertiary"
            style={{ borderRadius: identityMarkRadius(24), height: 24, width: 24 }}
        >
            <TaskStatusDisc className="size-4" status={status} />
        </span>
    );
}
