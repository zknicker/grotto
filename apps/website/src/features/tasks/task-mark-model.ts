import { formatRelativeTime } from '../../lib/format.ts';
import type { TaskStatus } from './task-presentation.ts';

/**
 * What a task looks like on the messages it touched, while its Thread is empty.
 *
 * A Thread that holds anything states its task in the chip on its own recessed
 * surface, where the lifecycle can be followed. Until somebody says something
 * there, that surface would be an empty frame — so the whole of the task reads
 * as one mark in the header of the message it was claimed or promoted against,
 * and this module is the one place those marks are decided.
 *
 * Tier says nothing here. An Agent's own background claim and a task a person
 * promoted wear the same mark for the same status, because what leaves the
 * header the only place to say it is the empty Thread, not the lens the task
 * belongs to.
 */
export type TaskClaimMarkState =
    | 'done'
    | 'idle'
    | 'in_review'
    | 'interrupted'
    | 'live'
    | 'none'
    | 'todo';

/** The task facts the marks read, however a surface spells its task. */
export interface TaskMarkFacts {
    claimedAt: string | null;
    live: boolean;
    number: number;
    /**
     * The assignee's run failed, was interrupted, or was stopped while it
     * still held the claim. No first-party read reports this today, so every
     * call site passes `false`; the state exists so the rule is written once.
     */
    runFailed?: boolean;
    status: TaskStatus;
    /**
     * Whether the task's own Thread surface states it. A Thread with replies
     * carries the task's chip in its header, so the message header stays
     * quiet; an empty Thread renders no surface at all, and a background
     * claim's surface withholds the title however full its Thread is, so both
     * leave the message header the only place the task can say itself.
     */
    threadStatesTask: boolean;
    /** Last write to the task row; for a finished claim, when it finished. */
    updatedAt: string;
}

/**
 * The mark on the human's anchor message.
 *
 * The status says which glyph, and liveness says whether anybody is standing
 * there now. `done` is the settling frame, not a resting state: the mark leaves
 * the anchor once the work lands, and the Agent's own reply carries the receipt
 * from then on. A closed task says nothing — nothing about it is still moving —
 * and neither does a task whose Thread surface already speaks for it.
 */
export function taskClaimMarkState(task: TaskMarkFacts): TaskClaimMarkState {
    if (task.threadStatesTask || task.status === 'closed') {
        return 'none';
    }
    if (task.status !== 'in_progress') {
        return task.status;
    }
    if (task.live) {
        return 'live';
    }
    return task.runFailed === true ? 'interrupted' : 'idle';
}

/**
 * Whether a task's status glyph gives way to the working ellipsis. The chip in
 * a Thread surface header asks this of a tracked task the same way the claim
 * mark asks it of a background one: a status disc says where the work stands,
 * and the ellipsis says somebody is standing there now.
 */
export function isTaskWorkingNow(task: Pick<TaskMarkFacts, 'live' | 'status'>): boolean {
    return task.live && task.status === 'in_progress';
}

/** One transcript message, as the handled-mark rule reads it. */
export interface HandledTaskMarkMessage {
    /** The authoring Agent, or null when a human wrote it. */
    agentId: string | null;
    id: string;
    /** The claim this message anchors, if it anchors one. */
    task: (TaskMarkFacts & { assigneeAgentId: string | null }) | null;
}

/** The receipt one Agent reply carries for the claim it answered. */
export interface HandledTaskMark {
    anchorMessageId: string;
    claimedAt: string | null;
    doneAt: string;
    number: number;
}

/**
 * Which reply closed which task, across the loaded transcript.
 *
 * The wire carries no link from a finished task back to the message that
 * answered it: `message_tasks` names the assignee and when the row last
 * changed, and nothing on a Chat message names a task it resolved. So the rule
 * is nearest-following: a done task no Thread surface states attaches to the
 * first later message its assignee Agent wrote in this Chat, and a message already
 * carrying a task of its own is skipped, so one header never speaks for two
 * tasks. Tasks are matched in order, so an Agent that closed two of them in
 * one visit puts a receipt on each of its next two messages.
 *
 * That is a heuristic, and it is wrong in exactly one shape: an Agent that
 * finishes a claim and says nothing until some later, unrelated turn. It marks
 * that later message. Nothing weaker is available without a run link on the
 * task row.
 */
export function deriveHandledTaskMarks(
    messages: readonly HandledTaskMarkMessage[]
): ReadonlyMap<string, HandledTaskMark> {
    const marks = new Map<string, HandledTaskMark>();
    const open: { agentId: string; mark: HandledTaskMark }[] = [];

    for (const message of messages) {
        // A message that anchors a task of its own already wears that task's
        // mark, so it is never also somebody else's receipt.
        if (message.task === null && message.agentId !== null) {
            const index = open.findIndex((entry) => entry.agentId === message.agentId);

            if (index !== -1) {
                marks.set(message.id, open[index].mark);
                open.splice(index, 1);
            }
        }

        const claimed = claimAwaitingReceipt(message);

        if (claimed) {
            open.push(claimed);
        }
    }

    return marks;
}

/**
 * The task this message anchors, if it finished with no Thread surface stating
 * it. A surface that carries the task's chip carries its outcome too, so no
 * reply elsewhere in the transcript claims it.
 */
function claimAwaitingReceipt(
    message: HandledTaskMarkMessage
): { agentId: string; mark: HandledTaskMark } | null {
    const task = message.task;

    if (!task || task.assigneeAgentId === null) {
        return null;
    }
    if (task.threadStatesTask || task.status !== 'done') {
        return null;
    }

    return {
        agentId: task.assigneeAgentId,
        mark: {
            anchorMessageId: message.id,
            claimedAt: task.claimedAt,
            doneAt: task.updatedAt,
            number: task.number,
        },
    };
}

export interface TaskMarkHoverRow {
    label: string;
    value: string;
}

/**
 * What the receipt's hover card answers, in the order the question is asked:
 * when the Agent took the work, how long it held it, and when it finished.
 */
export function handledTaskHoverRows(mark: HandledTaskMark, now = Date.now()): TaskMarkHoverRow[] {
    const held = taskClaimDurationMs(mark.claimedAt, mark.doneAt);

    return [
        {
            label: 'Claimed',
            value: mark.claimedAt === null ? '—' : formatRelativeTime(mark.claimedAt, now),
        },
        { label: 'Took', value: held === null ? '—' : formatTaskDuration(held) },
        { label: 'Done', value: formatRelativeTime(mark.doneAt, now) },
    ];
}

/** How long the claim was held, or null when either end is unknown. */
export function taskClaimDurationMs(claimedAt: string | null, doneAt: string): number | null {
    if (claimedAt === null) {
        return null;
    }
    const started = Date.parse(claimedAt);
    const finished = Date.parse(doneAt);

    if (Number.isNaN(started) || Number.isNaN(finished) || finished < started) {
        return null;
    }
    return finished - started;
}

/**
 * How long a claim was held. Seconds matter here in a way they never do for a
 * session: a task answered inside one turn is measured in them, so "18s" is
 * the answer and "under a minute" is not.
 */
export function formatTaskDuration(durationMs: number): string {
    const seconds = Math.round(durationMs / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        const remainingSeconds = seconds % 60;
        return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

export interface TaskMarkDot {
    delay: number;
    id: string;
}

export interface TaskMarkMotion {
    /** Whether the ellipsis breathes and the settle plays at all. */
    animated: boolean;
    dots: TaskMarkDot[];
    /** How long the done glyph holds before the mark leaves the message. */
    settleMs: number;
}

/**
 * The one motion budget these marks spend. Three dots, gently staggered, and a
 * settle short enough to read as the mark landing rather than as an animation.
 * Reduced motion keeps the same three dots and drops every moving part, so the
 * mark still says "claimed" while saying it silently.
 */
export function taskMarkMotion(reduceMotion: boolean): TaskMarkMotion {
    const ids = ['one', 'two', 'three'];

    return {
        animated: !reduceMotion,
        dots: ids.map((id, index) => ({ delay: reduceMotion ? 0 : index * 0.16, id })),
        settleMs: reduceMotion ? 0 : 200,
    };
}
