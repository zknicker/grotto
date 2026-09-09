import { CornerDownRightIcon } from '@hugeicons-pro/core-stroke-rounded';
import { motion, useReducedMotion } from 'framer-motion';
import { CursorHoverCard } from '../../components/ui/cursor-hover-card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { springs } from '../../lib/springs.ts';
import { taskContextLineClassName } from './task-claim-mark.tsx';
import {
    formatTaskDuration,
    type HandledTaskMark,
    handledTaskHoverRows,
    taskClaimDurationMs,
} from './task-mark-model.ts';
import { formatTaskNumber } from './task-presentation.ts';
import { TaskStatusDisc } from './task-status-disc.tsx';

/**
 * The receipt for a claim this message answered.
 *
 * When a background claim finishes, its context line leaves the human's
 * message — the question is answered, so nothing there is still pending — and
 * lands here, above the reply that answered it, in the same "replying to"
 * position. It is deliberately quiet: the reply is the result, and this only
 * says which piece of asked-for work it closed and how long it took.
 */
export function TaskHandledMark({
    mark,
    onOpenTask,
}: {
    mark: HandledTaskMark;
    /** Opens the task; absent where the host has no way into a Thread. */
    onOpenTask?: () => void;
}) {
    const reduceMotion = useReducedMotion() === true;

    return (
        <CursorHoverCard
            className="w-72"
            content={<TaskHandledHoverContent mark={mark} onOpenTask={onOpenTask} />}
            triggerClassName="min-w-0"
        >
            <motion.span
                animate={{ opacity: 1, scale: 1 }}
                className={taskContextLineClassName}
                data-testid="task-handled-mark"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                transition={springs.moderate}
            >
                <Icon
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                    icon={CornerDownRightIcon}
                    strokeWidth={2}
                />
                <span className="truncate tabular-nums">
                    Task {formatTaskNumber(mark)}
                    {handledDuration(mark)}
                </span>
            </motion.span>
        </CursorHoverCard>
    );
}

export function TaskHandledHoverContent({
    mark,
    onOpenTask,
}: {
    mark: HandledTaskMark;
    onOpenTask?: () => void;
}) {
    const rows = handledTaskHoverRows(mark);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <header className="flex min-w-0 items-center gap-2.5">
                <TaskStatusDisc className="size-5" status="done" />
                <strong className="min-w-0 truncate font-semibold text-foreground text-sm">
                    Task {formatTaskNumber(mark)}
                </strong>
            </header>
            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                {rows.map((row) => (
                    <div className="contents" key={row.label}>
                        <dt className="text-muted">{row.label}</dt>
                        <dd className="m-0 min-w-0 text-foreground tabular-nums">{row.value}</dd>
                    </div>
                ))}
            </dl>
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

/** How long the claim was held, when both ends of it are known. */
function handledDuration(mark: HandledTaskMark): string {
    const held = taskClaimDurationMs(mark.claimedAt, mark.doneAt);

    return held === null ? '' : ` · ${formatTaskDuration(held)}`;
}
