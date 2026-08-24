import { ChatMessage } from '@heroui-pro/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import {
    type MessageTask,
    type MessageTaskAssigneeProfile,
    MessageTaskChip,
    messageTaskAssigneeLabel,
} from '../../tasks/message-task-chip.tsx';
import { formatTaskNumber, taskStatusLabels } from '../../tasks/task-presentation.ts';
import { ActionTooltip } from '../chat-action-tooltip.tsx';
import { isActivityBackedMessageRow, isStreamingPostMessageRow } from '../chat-transcript-model.ts';
import {
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { isLocalTimelineMessageMetadata } from '../local-timeline-message.ts';
import { MessageReactionPills } from './message-reactions.tsx';
import { ThreadPreviewBlock } from './thread-preview-block.tsx';

export function ThreadMessageSurface({
    children,
    row,
}: {
    children: React.ReactNode;
    row: TranscriptMessageRow;
}) {
    return <EmbeddedThreadMessageSurface row={row}>{children}</EmbeddedThreadMessageSurface>;
}

function EmbeddedThreadMessageSurface({
    children,
    row,
}: {
    children: React.ReactNode;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();
    const durable = isThreadAnchorRow(row);
    const canOpenThread = Boolean(context?.threadActionsEnabled && durable);
    const taskLivesInPreview = Boolean(row.message.task && canOpenThread);
    const taskChipHidden = Boolean(context?.taskChipHidden);
    const taskAssigneeProfile = resolveTaskAssigneeProfile(row.message.task, context);
    const flashing = context?.flashMessageId === row.message.id;
    const openThread = () => context?.onOpenThread(row);
    const taskAssigneeLabel =
        taskAssigneeProfile?.name ??
        (row.message.task ? messageTaskAssigneeLabel(row.message.task) : null);

    return (
        <div
            className={cn(
                'group/message-row relative block min-w-0 rounded-lg',
                flashing && 'chat-thread-flash'
            )}
            data-message-id={row.message.id}
        >
            {children}
            <div className="flex flex-wrap items-center gap-1.5">
                {row.message.task && !(taskLivesInPreview || taskChipHidden) ? (
                    canOpenThread ? (
                        <ThreadTaskChipButton
                            ariaLabel={`Task ${formatTaskNumber(row.message.task)} — ${taskStatusLabels[row.message.task.status]}${taskAssigneeLabel ? `, ${taskAssigneeLabel}` : ''}. Open thread`}
                            onOpenThread={openThread}
                            task={row.message.task}
                        />
                    ) : (
                        <MessageTaskChip
                            assigneeProfile={taskAssigneeProfile}
                            task={row.message.task}
                        />
                    )
                ) : null}
                <MessageReactionPills row={row} />
            </div>
            {canOpenThread ? (
                <ThreadPreviewBlock
                    headerLeading={
                        row.message.task && taskLivesInPreview && !taskChipHidden ? (
                            <MessageTaskChip
                                assigneeProfile={taskAssigneeProfile}
                                task={row.message.task}
                            />
                        ) : undefined
                    }
                    row={row}
                />
            ) : null}
        </div>
    );
}

export function ThreadTaskChipButton({
    ariaLabel,
    onOpenThread,
    task,
}: {
    ariaLabel: string;
    onOpenThread: () => void;
    task: MessageTask;
}) {
    return (
        <button
            aria-label={ariaLabel}
            className="inline-flex cursor-[var(--cursor-interactive)] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onOpenThread}
            type="button"
        >
            <MessageTaskChip task={task} />
        </button>
    );
}

function resolveTaskAssigneeProfile(
    task: MessageTask | null | undefined,
    context: ReturnType<typeof useTranscriptRenderContextOptional>
): MessageTaskAssigneeProfile | null {
    if (!(task?.assignee?.kind && context?.resolveActorProfile)) {
        return null;
    }

    const profile = context.resolveActorProfile({
        id: task.assignee.id,
        kind: task.assignee.kind === 'agent' ? 'agent' : 'participant',
    });

    return profile ? { avatarUrl: profile.avatarUrl, name: profile.name } : null;
}

/**
 * The reply-in-thread affordance for one message, rendered as a stock
 * ChatMessage action so it shares the turn's single hover actions bar
 * beside copy and turn details.
 */
export function ThreadMessageActions({
    className,
    row,
}: {
    className?: string;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();
    const canOpenThread = Boolean(context?.threadActionsEnabled && isThreadAnchorRow(row));

    if (!context) {
        return null;
    }

    if (!canOpenThread) {
        return null;
    }

    return (
        <ActionTooltip label="Reply in thread">
            <ChatMessage.Action
                aria-label="Reply in thread"
                className={className}
                onPress={() => context.onOpenThread(row)}
            >
                <Icon icon={BubbleChatIcon} />
            </ChatMessage.Action>
        </ActionTooltip>
    );
}

/** Only Server-persisted, settled chat messages can anchor actions. */
export function isThreadAnchorRow(row: TranscriptMessageRow) {
    return (
        row.message.id.startsWith('msg_') &&
        !isActivityBackedMessageRow(row) &&
        !isLocalTimelineMessageMetadata(row.message.metadata) &&
        !isStreamingPostMessageRow(row)
    );
}
