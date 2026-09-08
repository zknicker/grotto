import { useTranscriptRenderContextOptional } from '../chats/chat-transcript-render-context.tsx';
import type { TranscriptMessageRow } from '../chats/transcript-contract.ts';
import { type MessageTaskAssigneeProfile, MessageTaskChip } from './message-task-chip.tsx';

/**
 * The task chip as a transcript row renders it. The assignee's face and name
 * resolve through the one actor resolver every other row already reads, so an
 * assignee who has since left the Server reads the same here as anywhere.
 */
export function TranscriptTaskChip({ row }: { row: TranscriptMessageRow }) {
    const resolve = useTranscriptRenderContextOptional()?.resolveActorProfile;
    const task = row.message.task;

    if (!task) {
        return null;
    }

    const assignee = task.assignee;
    const profile: MessageTaskAssigneeProfile | null =
        assignee?.kind && resolve
            ? (resolve({
                  id: assignee.id,
                  kind: assignee.kind === 'agent' ? 'agent' : 'participant',
              }) ?? null)
            : null;

    return <MessageTaskChip assigneeProfile={profile} task={task} />;
}
