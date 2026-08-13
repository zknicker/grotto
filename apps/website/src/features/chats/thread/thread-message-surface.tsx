import { Label } from '@heroui/react';
import { ChatMessage, ContextMenu } from '@heroui-pro/react';
import {
    Bookmark01Icon,
    BubbleChatIcon,
    Copy01Icon,
    Task01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { isLocalTimelineMessageMetadata } from '../../../hooks/chats/chat-timeline-messages.ts';
import { useTaskConvert } from '../../../hooks/tasks/use-task-mutations.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { cn } from '../../../lib/utils.ts';
import {
    type MessageTask,
    type MessageTaskAssigneeProfile,
    MessageTaskChip,
    messageTaskAssigneeLabel,
} from '../../tasks/message-task-chip.tsx';
import { formatTaskNumber, taskStatusLabels } from '../../tasks/task-presentation.ts';
import { TaskStatusMenu } from '../../tasks/task-status-menu.tsx';
import { ActionTooltip } from '../chat-action-tooltip.tsx';
import { isActivityBackedMessageRow, isStreamingPostMessageRow } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { MessageReactionPills, QuickReactionStrip } from './message-reactions.tsx';
import { ThreadPreviewBlock } from './thread-preview-block.tsx';

export function ThreadMessageSurface({
    children,
    row,
}: {
    children: React.ReactNode;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();

    if (context?.turnEvidenceSource === 'embedded') {
        return <EmbeddedThreadMessageSurface row={row}>{children}</EmbeddedThreadMessageSurface>;
    }

    return <RuntimeThreadMessageSurface row={row}>{children}</RuntimeThreadMessageSurface>;
}

function RuntimeThreadMessageSurface({
    children,
    row,
}: {
    children: React.ReactNode;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();
    const convert = useTaskConvert();
    const durable = isThreadAnchorRow(row);
    const canOpenThread = Boolean(context?.threadActionsEnabled && durable);
    const thread = getTranscriptMessageThread(row);
    const taskLivesInPreview = Boolean(row.message.task && canOpenThread);
    const taskAssigneeProfile = resolveTaskAssigneeProfile(row.message.task, context);
    const taskAssigneeLabel =
        taskAssigneeProfile?.name ??
        (row.message.task ? messageTaskAssigneeLabel(row.message.task) : null);
    const flashing = context?.flashMessageId === row.message.id;
    const openThread = () => context?.onOpenThread(row);
    const menuActions: Record<string, () => void> = {
        'convert-task': () => convert.mutate({ messageId: row.message.id, origin: 'converted' }),
        'copy-link': () =>
            void writeClipboardText(
                context?.chatId
                    ? `${window.location.origin}${appRoutes.chat(context.chatId)}`
                    : window.location.href
            ),
        'copy-markdown': () => void writeClipboardText(row.message.content),
        'open-thread': openThread,
        'unfollow-thread': () => thread && context?.onUnfollowThread(thread.threadChatId),
    };

    return (
        <ContextMenu>
            <ContextMenu.Trigger
                className={cn(
                    'group/message-row relative block min-w-0 rounded-lg',
                    flashing && 'chat-thread-flash'
                )}
            >
                {children}
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.message.task && !taskLivesInPreview ? (
                        <TaskStatusMenu
                            ariaLabel={`Change status for task ${formatTaskNumber(row.message.task)}${taskAssigneeLabel ? `, ${taskAssigneeLabel}` : ''}`}
                            messageId={row.message.id}
                            status={row.message.task.status}
                        >
                            <MessageTaskChip
                                assigneeProfile={taskAssigneeProfile}
                                task={row.message.task}
                            />
                        </TaskStatusMenu>
                    ) : null}
                    <MessageReactionPills row={row} />
                </div>
                {canOpenThread ? (
                    <ThreadPreviewBlock
                        headerLeading={
                            row.message.task && taskLivesInPreview ? (
                                <TaskStatusMenu
                                    ariaLabel={`Change status for task ${formatTaskNumber(row.message.task)}${taskAssigneeLabel ? `, ${taskAssigneeLabel}` : ''}`}
                                    messageId={row.message.id}
                                    status={row.message.task.status}
                                >
                                    <MessageTaskChip
                                        assigneeProfile={taskAssigneeProfile}
                                        task={row.message.task}
                                    />
                                </TaskStatusMenu>
                            ) : undefined
                        }
                        isHeaderLeadingInteractive
                        row={row}
                    />
                ) : null}
            </ContextMenu.Trigger>
            <ContextMenu.Popover>
                <QuickReactionStrip row={row} />
                <ContextMenu.Menu onAction={(key) => menuActions[String(key)]?.()}>
                    <ContextMenu.Item id="copy-link" textValue="Copy Link">
                        <Icon icon={Copy01Icon} />
                        <Label>Copy Link</Label>
                    </ContextMenu.Item>
                    <ContextMenu.Item id="copy-markdown" textValue="Copy Markdown">
                        <Icon icon={Copy01Icon} />
                        <Label>Copy Markdown</Label>
                    </ContextMenu.Item>
                    {/* Select Message is deliberately omitted; Electron-native selection owns it. */}
                    <ContextMenu.Separator />
                    {canOpenThread ? (
                        <ContextMenu.Item id="open-thread" textValue="Open Thread">
                            <Icon icon={BubbleChatIcon} />
                            <Label>Open Thread</Label>
                        </ContextMenu.Item>
                    ) : null}
                    {thread?.followed && canOpenThread ? (
                        <ContextMenu.Item id="unfollow-thread" textValue="Unfollow Thread">
                            <Icon icon={Bookmark01Icon} />
                            <Label>Unfollow Thread</Label>
                        </ContextMenu.Item>
                    ) : null}
                    {/* Save Message ships with the later bookmarks workstream. */}
                    {canOpenThread && !row.message.task && row.message.senderType !== 'system' ? (
                        <ContextMenu.Item id="convert-task" textValue="Convert to Task">
                            <Icon icon={Task01Icon} />
                            <Label>Convert to Task</Label>
                        </ContextMenu.Item>
                    ) : null}
                </ContextMenu.Menu>
            </ContextMenu.Popover>
        </ContextMenu>
    );
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
                {row.message.task && !taskLivesInPreview ? (
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
                        row.message.task && taskLivesInPreview ? (
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

/** Only Runtime-persisted, settled chat messages can anchor actions. */
export function isThreadAnchorRow(row: TranscriptMessageRow) {
    return (
        row.message.id.startsWith('msg_') &&
        !isActivityBackedMessageRow(row) &&
        !isLocalTimelineMessageMetadata(row.message.metadata) &&
        !isStreamingPostMessageRow(row)
    );
}
