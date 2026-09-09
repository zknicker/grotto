import type { TranscriptItem } from '../chats/chat-transcript-model.ts';
import { useTranscriptRenderContextOptional } from '../chats/chat-transcript-render-context.tsx';
import type { TranscriptMessageRow } from '../chats/transcript-contract.ts';
import { type TaskClaimAssignee, TaskClaimMark } from './task-claim-mark.tsx';
import { TaskHandledMark } from './task-handled-mark.tsx';
import { messageTaskAssigneeLabel } from './task-presentation.ts';

/**
 * The claim mark as a transcript row renders it: the claim on this message, if
 * it is a background one, with its claimant resolved through the same actor
 * resolver every other row reads.
 */
export function TranscriptTaskClaimMark({ row }: { row: TranscriptMessageRow }) {
    const context = useTranscriptRenderContextOptional();
    const task = row.message.task;

    // A Thread opened on the task states all of this above the anchor.
    if (!task || context?.taskChipHiddenMessageId === row.message.id) {
        return null;
    }

    return (
        <TaskClaimMark
            assignee={resolveClaimAssignee(task, context)}
            onOpenTask={context?.threadActionsEnabled ? () => context.onOpenThread(row) : undefined}
            task={{
                claimedAt: task.claimed_at,
                live: task.live,
                number: task.number,
                status: task.status,
                tier: task.tier,
                updatedAt: task.updated_at,
            }}
        />
    );
}

/**
 * The receipt as a transcript row renders it. Which reply closed which claim is
 * a whole-transcript question, so the answer arrives through the render context
 * rather than being re-derived per row.
 */
export function TranscriptTaskHandledMark({ messageId }: { messageId: string }) {
    const context = useTranscriptRenderContextOptional();
    const mark = context?.handledTaskMarks?.get(messageId);

    if (!mark) {
        return null;
    }

    return (
        <TaskHandledMark
            mark={mark}
            onOpenTask={
                context?.threadActionsEnabled
                    ? () => context.onOpenThread({ message: { id: mark.anchorMessageId } })
                    : undefined
            }
        />
    );
}

function resolveClaimAssignee(
    task: NonNullable<TranscriptMessageRow['message']['task']>,
    context: ReturnType<typeof useTranscriptRenderContextOptional>
): TaskClaimAssignee | null {
    const assignee = task.assignee;

    if (!assignee) {
        return null;
    }

    const profile = assignee.kind
        ? context?.resolveActorProfile?.({
              id: assignee.id,
              kind: assignee.kind === 'agent' ? 'agent' : 'participant',
          })
        : null;

    if (profile) {
        return { avatarUrl: profile.avatarUrl, name: profile.name };
    }

    const label = messageTaskAssigneeLabel(task);
    return label === null ? null : { avatarUrl: null, name: label };
}

/**
 * The turn's own background claim, if it carries one. A message with a task
 * always stands as its own row, so a turn header speaks for at most one claim
 * and never puts a second message's mark on the first message's line.
 */
export function TranscriptTurnTaskClaimMark({ items }: { items: TranscriptItem[] }) {
    for (const item of items) {
        if (item.kind === 'row' && item.row.kind === 'message' && item.row.message.task) {
            return <TranscriptTaskClaimMark row={item.row} />;
        }
    }

    return null;
}

/** The receipt for a claim one of this turn's messages answered. */
export function TranscriptTurnTaskHandledMark({ items }: { items: TranscriptItem[] }) {
    const marks = useTranscriptRenderContextOptional()?.handledTaskMarks;

    if (!marks) {
        return null;
    }

    for (const item of items) {
        if (item.kind === 'row' && item.row.kind === 'message' && marks.has(item.row.message.id)) {
            return <TranscriptTaskHandledMark messageId={item.row.message.id} />;
        }
    }

    return null;
}
