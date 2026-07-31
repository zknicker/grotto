import { Button, Label, Popover } from '@heroui/react';
import { ContextMenu } from '@heroui-pro/react';
import {
    Bookmark01Icon,
    BubbleChatIcon,
    Copy01Icon,
    SmileIcon,
    Task01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { isLocalTimelineMessageMetadata } from '../../../hooks/chats/chat-timeline-messages.ts';
import { useChatReaction } from '../../../hooks/chats/use-chat-reaction.ts';
import { useTaskConvert } from '../../../hooks/tasks/use-task-mutations.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { cn } from '../../../lib/utils.ts';
import { MessageTaskChip, messageTaskAssigneeLabel } from '../../tasks/message-task-chip.tsx';
import { formatTaskNumber, taskStatusLabels } from '../../tasks/task-presentation.ts';
import { TaskStatusMenu } from '../../tasks/task-status-menu.tsx';
import { isActivityBackedMessageRow, isStreamingPostMessageRow } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { ThreadReplyPill } from './thread-reply-pill.tsx';

export const quickReactionEmoji = ['👍', '❤️', '🎉', '👀', '🔥', '😂', '✅'] as const;

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
    const reaction = useChatReaction();
    const convert = useTaskConvert();
    const durable = isThreadAnchorRow(row);
    const canOpenThread = Boolean(context?.threadActionsEnabled && durable);
    const thread = getTranscriptMessageThread(row);
    const active = context?.activeThreadAnchorId === row.message.id;
    const flashing = context?.flashMessageId === row.message.id;
    const ownReaction = (emoji: string) =>
        row.message.reactions
            ?.find((item) => item.emoji === emoji)
            ?.actors.some(({ id }) => id === 'usr_tavern') ?? false;
    const toggleReaction = (emoji: string) =>
        reaction.mutate({ emoji, messageId: row.message.id, remove: ownReaction(emoji) });
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
                    active && 'bg-active ring-1 ring-brand-ring',
                    flashing && 'chat-thread-flash'
                )}
            >
                <MessageHoverActions
                    canOpenThread={canOpenThread}
                    onOpenThread={openThread}
                    onReact={toggleReaction}
                />
                {children}
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.message.task ? (
                        <TaskStatusMenu
                            ariaLabel={`Change status for task ${formatTaskNumber(row.message.task)}${row.message.task.assignee?.handle ? ` @${row.message.task.assignee.handle}` : ''}`}
                            messageId={row.message.id}
                            status={row.message.task.status}
                        >
                            <MessageTaskChip task={row.message.task} />
                        </TaskStatusMenu>
                    ) : null}
                    {thread && canOpenThread ? (
                        <ThreadReplyPill onClick={openThread} summary={thread} />
                    ) : null}
                    <ReactionPills
                        onToggle={toggleReaction}
                        reactions={row.message.reactions ?? []}
                    />
                </div>
            </ContextMenu.Trigger>
            <ContextMenu.Popover>
                <QuickReactionStrip onReact={toggleReaction} />
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
    const thread = getTranscriptMessageThread(row);
    const active = context?.activeThreadAnchorId === row.message.id;
    const flashing = context?.flashMessageId === row.message.id;
    const openThread = () => context?.onOpenThread(row);
    const taskAssigneeLabel = row.message.task ? messageTaskAssigneeLabel(row.message.task) : null;

    return (
        <div
            className={cn(
                'group/message-row relative block min-w-0 rounded-lg',
                active && 'bg-active ring-1 ring-brand-ring',
                flashing && 'chat-thread-flash'
            )}
            data-message-id={row.message.id}
        >
            <MessageHoverActions
                canOpenThread={canOpenThread}
                onOpenThread={openThread}
                onReact={() => undefined}
                reactionsEnabled={false}
            />
            {children}
            {row.message.task || (thread && canOpenThread) ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.message.task && canOpenThread ? (
                        <button
                            aria-label={`Task ${formatTaskNumber(row.message.task)} — ${taskStatusLabels[row.message.task.status]}${taskAssigneeLabel ? `, ${taskAssigneeLabel}` : ''}. Open thread`}
                            className="inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                            onClick={openThread}
                            type="button"
                        >
                            <MessageTaskChip task={row.message.task} />
                        </button>
                    ) : row.message.task ? (
                        <MessageTaskChip task={row.message.task} />
                    ) : null}
                    {thread && canOpenThread ? (
                        <ThreadReplyPill onClick={openThread} summary={thread} />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function MessageHoverActions({
    canOpenThread,
    onOpenThread,
    onReact,
    reactionsEnabled = true,
}: {
    canOpenThread: boolean;
    onOpenThread: () => void;
    onReact: (emoji: string) => void;
    reactionsEnabled?: boolean;
}) {
    return (
        <div className="absolute -top-3 right-1 z-10 flex items-center gap-0.5 rounded-lg border border-separator bg-overlay p-0.5 opacity-0 focus-within:opacity-100 group-hover/message-row:opacity-100">
            {canOpenThread ? (
                <Button
                    aria-label="Reply in thread"
                    isIconOnly
                    onPress={onOpenThread}
                    size="sm"
                    variant="ghost"
                >
                    <Icon icon={BubbleChatIcon} />
                </Button>
            ) : null}
            {reactionsEnabled ? (
                <Popover>
                    <Button aria-label="Add Reaction" isIconOnly size="sm" variant="ghost">
                        <Icon icon={SmileIcon} />
                    </Button>
                    <Popover.Content placement="bottom end">
                        <Popover.Dialog>
                            <QuickReactionStrip onReact={onReact} />
                        </Popover.Dialog>
                    </Popover.Content>
                </Popover>
            ) : null}
        </div>
    );
}

function QuickReactionStrip({ onReact }: { onReact: (emoji: string) => void }) {
    return (
        <div className="flex gap-0.5">
            {quickReactionEmoji.map((emoji) => (
                <Button
                    aria-label={`React with ${emoji}`}
                    isIconOnly
                    key={emoji}
                    onPress={() => onReact(emoji)}
                    size="sm"
                    variant="ghost"
                >
                    {emoji}
                </Button>
            ))}
        </div>
    );
}

function ReactionPills({
    onToggle,
    reactions,
}: {
    onToggle: (emoji: string) => void;
    reactions: NonNullable<TranscriptMessageRow['message']['reactions']>;
}) {
    return (
        <>
            {reactions.map((reaction) => {
                const own = reaction.actors.some(({ id }) => id === 'usr_tavern');
                const handles = reaction.actors
                    .map(({ handle, id }) => handle ?? (id === 'usr_tavern' ? 'you' : id))
                    .join(', ');
                return (
                    <button
                        aria-label={`${reaction.emoji} reaction from ${handles}`}
                        className={cn(
                            'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-meta',
                            own
                                ? 'border-brand-ring bg-brand-muted text-brand-muted-foreground'
                                : 'border-border-subtle bg-legacy-muted text-muted-foreground'
                        )}
                        key={reaction.emoji}
                        onClick={() => onToggle(reaction.emoji)}
                        type="button"
                    >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.actors.length}</span>
                    </button>
                );
            })}
        </>
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
