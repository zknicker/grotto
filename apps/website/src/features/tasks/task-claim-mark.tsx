import { motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { CursorHoverCard } from '../../components/ui/cursor-hover-card.tsx';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { springs } from '../../lib/springs.ts';
import { TaskClaimHoverContent } from './task-claim-hover-card.tsx';
import { TaskLiveEllipsis } from './task-live-ellipsis.tsx';
import {
    type TaskClaimMarkState,
    type TaskMarkFacts,
    taskClaimMarkState,
    taskMarkMotion,
} from './task-mark-model.ts';
import { formatTaskNumber, taskStatusDiscClasses, taskStatusLabels } from './task-presentation.ts';
import { TaskStatusDisc } from './task-status-disc.tsx';

export interface TaskClaimAssignee {
    avatarUrl: null | string;
    name: string;
}

/** The shared footprint of a task context line, on either message it lands on. */
export const taskContextLineClassName =
    'flex min-w-0 items-center gap-1.5 text-muted text-xs leading-5';

/**
 * The task on this message, while its Thread is empty.
 *
 * A task with nothing said in its Thread has no card to live in, so it says the
 * whole of itself on a context line between the header and the body — the same
 * place a reply states what it is replying to. Who is on it and where the work
 * stands belong to the message, not to the author's identity line, so the
 * header stays name and time.
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
                className={taskContextLineClassName}
                data-state={state}
                data-testid="task-claim-mark"
            >
                {/* The line says in words what the label says for a reader who
                    cannot see it, so only one of them is announced. */}
                <span aria-hidden="true" className={taskContextLineClassName}>
                    <TaskClaimLine
                        assignee={assignee}
                        reduceMotion={reduceMotion}
                        state={state}
                        task={task}
                    />
                </span>
                <span className="sr-only">{claimMarkLabel(state, task, assignee)}</span>
            </span>
        </CursorHoverCard>
    );
}

/**
 * The claim in one line. A run standing on the task is named — a person reads
 * "Blippy is on it" and stops asking — while a task nobody holds is a number
 * and a status, because there is nobody to name.
 */
function TaskClaimLine({
    assignee,
    reduceMotion,
    state,
    task,
}: {
    assignee: TaskClaimAssignee | null;
    reduceMotion: boolean;
    state: TaskClaimMarkState;
    task: TaskMarkFacts;
}) {
    if (state === 'todo' || state === 'in_review') {
        return (
            <>
                <TaskStatusDisc className="size-3.5" status={state} />
                <TaskLineLabel suffix={state === 'todo' ? 'unclaimed' : 'in review'} task={task} />
            </>
        );
    }

    if (state === 'interrupted') {
        return (
            <>
                <TaskStatusDisc className="size-3.5 text-warning" status="in_progress" />
                {assignee ? (
                    <span className="truncate">{assignee.name} stopped</span>
                ) : (
                    <TaskLineLabel suffix="stopped" task={task} />
                )}
            </>
        );
    }

    if (!assignee) {
        return (
            <>
                <TaskStatusDisc className="size-3.5" status="in_progress" />
                <TaskLineLabel suffix="claimed" task={task} />
            </>
        );
    }

    return (
        <>
            <EntityAvatar name={assignee.name} size={14} src={assignee.avatarUrl} />
            <span className="truncate">{assignee.name} is on it</span>
            <TaskClaimGlyph reduceMotion={reduceMotion} state={state} />
        </>
    );
}

/** `Task #4 · <where it stands>`, with the number tabular wherever it lands. */
function TaskLineLabel({ suffix, task }: { suffix: string; task: TaskMarkFacts }) {
    return (
        <span className="truncate tabular-nums">
            Task {formatTaskNumber(task)} · {suffix}
        </span>
    );
}

/** What trails a named claimant: motion while a run holds it, a disc otherwise. */
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
        // once, before the line leaves the message for the Agent's reply.
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

    return <TaskStatusDisc className="size-3.5" status="in_progress" />;
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
    if (state === 'in_review' || state === 'todo') {
        return `Task ${formatTaskNumber(task)} ${taskStatusLabels[state].toLowerCase()}${owner}`;
    }
    return `Task ${formatTaskNumber(task)} claimed${owner}`;
}
