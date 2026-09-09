import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import type { TaskClaimAssignee } from './task-claim-mark.tsx';
import type { TaskClaimMarkState, TaskMarkFacts } from './task-mark-model.ts';
import { formatTaskNumber } from './task-presentation.ts';
import { TaskStatusDisc } from './task-status-disc.tsx';

/**
 * The task in words: who holds it, since when, and the one way in.
 *
 * There is no "convert to tracked task" action here. Tier is inferred from
 * evidence rather than declared, and no first-party mutation stamps a task
 * tracked without also moving its status — so the card offers the honest door
 * instead: open the task, and saying anything in its Thread tracks it.
 */
export function TaskClaimHoverContent({
    assignee,
    onOpenTask,
    state,
    task,
}: {
    assignee: TaskClaimAssignee | null;
    onOpenTask?: () => void;
    state: TaskClaimMarkState;
    task: TaskMarkFacts;
}) {
    const claimedAt = task.claimedAt;

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <header className="flex min-w-0 items-center gap-2.5">
                {assignee ? (
                    <EntityAvatar name={assignee.name} size={24} src={assignee.avatarUrl} />
                ) : (
                    <TaskStatusDisc className="size-5" status={task.status} />
                )}
                <strong className="min-w-0 truncate font-semibold text-foreground text-sm">
                    Task {formatTaskNumber(task)}
                </strong>
            </header>
            <p className="text-muted text-sm leading-snug">
                {claimOwnerLine(assignee, task)}
                {claimedAt === null ? null : (
                    <>
                        {' · '}
                        <span className="tabular-nums">{formatRelativeTime(claimedAt)}</span>
                    </>
                )}
            </p>
            <p className="text-muted text-xs leading-snug">{claimStateNote(state)}</p>
            {onOpenTask ? (
                <div className="border-separator border-t pt-3">
                    <button
                        className="inline-flex w-fit cursor-[var(--cursor-interactive)] items-center gap-1 font-semibold text-accent text-xs"
                        onClick={onOpenTask}
                        type="button"
                    >
                        Open task
                    </button>
                </div>
            ) : null}
        </div>
    );
}

/** Who holds the task, without claiming somebody does when nobody has. */
function claimOwnerLine(assignee: TaskClaimAssignee | null, task: TaskMarkFacts): string {
    if (assignee) {
        return `Claimed by ${assignee.name}`;
    }
    return task.status === 'todo' ? 'Unclaimed' : 'Claimed';
}

function claimStateNote(state: TaskClaimMarkState): string {
    switch (state) {
        case 'live':
            return 'Working on it now.';
        case 'interrupted':
            return 'The run holding this claim stopped before it finished.';
        case 'done':
            return 'Finished.';
        case 'in_review':
            return 'Waiting on a look.';
        case 'todo':
            return 'Nobody has taken this yet.';
        default:
            return 'Claimed, waiting on its next turn.';
    }
}
