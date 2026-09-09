import { motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { CursorHoverCard } from '../../components/ui/cursor-hover-card.tsx';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { TaskLiveEllipsis } from './task-live-ellipsis.tsx';
import {
    type TaskClaimMarkState,
    type TaskMarkFacts,
    taskClaimMarkState,
    taskMarkMotion,
} from './task-mark-model.ts';
import { formatTaskNumber, taskStatusDiscClasses } from './task-presentation.ts';
import { TaskStatusDisc } from './task-status-disc.tsx';

export interface TaskClaimAssignee {
    avatarUrl: null | string;
    name: string;
}

/**
 * An Agent has taken this message and is working on it.
 *
 * A background claim never takes the task chip on a recessed surface, whether
 * or not its Thread has replies — it says the whole of itself here, in the
 * header of the message it was claimed against, after the time: a face and an
 * ellipsis while the run holds it, the ordinary in-progress glyph when nobody
 * is on it, and nothing once the Agent's own reply carries the receipt.
 */
export function TaskClaimMark({
    assignee,
    onOpenTask,
    task,
}: {
    assignee: TaskClaimAssignee | null;
    /** Opens the task; absent where the host has no way into a Thread. */
    onOpenTask?: () => void;
    task: TaskMarkFacts;
}) {
    const reduceMotion = useReducedMotion() === true;
    const state = taskClaimMarkState(task);
    const settling = useClaimSettle(state, taskMarkMotion(reduceMotion).settleMs);

    if (state === 'none' || (state === 'done' && !settling)) {
        return null;
    }

    return (
        <CursorHoverCard
            className="w-72"
            content={
                <TaskClaimHoverContent
                    assignee={assignee}
                    onOpenTask={onOpenTask}
                    state={state}
                    task={task}
                />
            }
            triggerClassName="min-w-0"
        >
            <span
                className="inline-flex shrink-0 items-center gap-1.5 leading-5"
                data-state={state}
                data-testid="task-claim-mark"
            >
                {assignee ? (
                    <EntityAvatar name={assignee.name} size={14} src={assignee.avatarUrl} />
                ) : null}
                <TaskClaimGlyph reduceMotion={reduceMotion} state={state} />
                <span className="sr-only">{claimMarkLabel(state, task, assignee)}</span>
            </span>
        </CursorHoverCard>
    );
}

function TaskClaimGlyph({
    reduceMotion,
    state,
}: {
    reduceMotion: boolean;
    state: TaskClaimMarkState;
}) {
    if (state === 'live') {
        return <TaskLiveEllipsis className={taskStatusDiscClasses.in_progress} />;
    }

    if (state === 'done') {
        // The settle: the ellipsis stops and the outcome lands in its place,
        // once, before the mark leaves the message for the Agent's reply.
        return (
            <motion.span
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
                transition={springs.moderate}
            >
                <TaskStatusDisc className="size-3.5" status="done" />
            </motion.span>
        );
    }

    return (
        <TaskStatusDisc
            className={cn('size-3.5', state === 'interrupted' && 'text-warning')}
            status="in_progress"
        />
    );
}

/**
 * The claim in words: who holds it, since when, and the one way in.
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
                    <TaskStatusDisc className="size-5" status="in_progress" />
                )}
                <strong className="min-w-0 truncate font-semibold text-foreground text-sm">
                    Task {formatTaskNumber(task)}
                </strong>
            </header>
            <p className="text-muted text-sm leading-snug">
                {assignee ? `Claimed by ${assignee.name}` : 'Claimed'}
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

/**
 * The settle window. A claim that is already finished when the transcript
 * loads never plays it — there is nothing to settle from — so this fires only
 * when a mark a reader was watching goes done under them.
 */
function useClaimSettle(state: TaskClaimMarkState, settleMs: number) {
    const [settling, setSettling] = React.useState(false);
    const previous = React.useRef(state);

    React.useEffect(() => {
        const wasWorking = previous.current !== 'done' && previous.current !== 'none';
        previous.current = state;

        if (!(wasWorking && state === 'done' && settleMs > 0)) {
            return;
        }

        setSettling(true);
        const timer = window.setTimeout(() => setSettling(false), settleMs);

        return () => window.clearTimeout(timer);
    }, [settleMs, state]);

    return settling && state === 'done';
}

function claimStateNote(state: TaskClaimMarkState): string {
    switch (state) {
        case 'live':
            return 'Working on it now.';
        case 'interrupted':
            return 'The run holding this claim stopped before it finished.';
        case 'done':
            return 'Finished.';
        default:
            return 'Claimed, waiting on its next turn.';
    }
}

function claimMarkLabel(
    state: TaskClaimMarkState,
    task: TaskMarkFacts,
    assignee: TaskClaimAssignee | null
): string {
    const owner = assignee ? ` by ${assignee.name}` : '';

    if (state === 'done') {
        return `Task ${formatTaskNumber(task)} done`;
    }
    if (state === 'live') {
        return `Task ${formatTaskNumber(task)} claimed${owner}, working now`;
    }
    if (state === 'interrupted') {
        return `Task ${formatTaskNumber(task)} claimed${owner}, run interrupted`;
    }
    return `Task ${formatTaskNumber(task)} claimed${owner}`;
}
