import {
    type TranscriptMessageRow,
    type TranscriptRenderContextValue,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { isThreadAnchorRow } from '../thread/thread-anchor.ts';
import { type MessageTaskAssigneeProfile, MessageTaskMark } from './message-task-mark.tsx';

/**
 * The turn header's task mark, wired to the transcript it renders in.
 *
 * The mark itself is presentational; this is the one place that decides
 * whether the surface can open a Thread and who the assignee resolves to, so
 * the header stays a layout and the mark stays a shape.
 */
export function TurnTaskMark({ row }: { row: TranscriptMessageRow }) {
    const context = useTranscriptRenderContextOptional();
    const task = row.message.task;

    if (!task || context?.taskMarkHidden) {
        return null;
    }

    const canOpenThread = Boolean(context?.threadActionsEnabled && isThreadAnchorRow(row));

    return (
        <MessageTaskMark
            assigneeProfile={resolveTaskAssigneeProfile(task, context)}
            onOpenThread={canOpenThread ? () => context?.onOpenThread(row) : undefined}
            task={task}
        />
    );
}

function resolveTaskAssigneeProfile(
    task: NonNullable<TranscriptMessageRow['message']['task']>,
    context: TranscriptRenderContextValue | null
): MessageTaskAssigneeProfile | null {
    if (!(task.assignee?.kind && context?.resolveActorProfile)) {
        return null;
    }

    const profile = context.resolveActorProfile({
        id: task.assignee.id,
        kind: task.assignee.kind === 'agent' ? 'agent' : 'participant',
    });

    return profile ? { avatarUrl: profile.avatarUrl, name: profile.name } : null;
}
