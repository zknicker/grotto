import {
    Bookmark01Icon,
    BubbleChatIcon,
    Copy01Icon,
    SmileIcon,
    Task01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import {
    ContextMenu,
    ContextMenuItem,
    ContextMenuPopup,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '../../../components/ui/context-menu.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Popover, PopoverPopup, PopoverTrigger } from '../../../components/ui/popover.tsx';
import { isLocalTimelineMessageMetadata } from '../../../hooks/chats/chat-timeline-messages.ts';
import { useChatReaction } from '../../../hooks/chats/use-chat-reaction.ts';
import { useTaskConvert } from '../../../hooks/tasks/use-task-mutations.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { cn } from '../../../lib/utils.ts';
import {
    formatTaskNumber,
    taskStatusClasses,
    taskStatusIcons,
} from '../../tasks/task-presentation.ts';
import { TaskStatusMenu } from '../../tasks/task-status-menu.tsx';
import { isActivityBackedMessageRow, isStreamingPostMessageRow } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { ThreadReplyPill } from './thread-reply-pill.tsx';

export const quickReactionEmoji = ['👍', '❤️', '🎉', '👀', '🔥', '😂', '✅'] as const;
const actionButtonClassName =
    'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground';

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

    return (
        <ContextMenu>
            <ContextMenuTrigger
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
                            <span
                                className={cn(
                                    'inline-flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-meta',
                                    taskStatusClasses[row.message.task.status]
                                )}
                            >
                                <Icon
                                    className="size-3.5"
                                    icon={taskStatusIcons[row.message.task.status]}
                                />
                                {formatTaskNumber(row.message.task)}
                                {row.message.task.assignee?.handle
                                    ? ` @${row.message.task.assignee.handle}`
                                    : ''}
                            </span>
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
            </ContextMenuTrigger>
            <ContextMenuPopup className="w-52">
                <QuickReactionStrip onReact={toggleReaction} />
                <ContextMenuItem
                    onClick={() =>
                        void writeClipboardText(
                            context?.chatId
                                ? `${window.location.origin}${appRoutes.chat(context.chatId)}`
                                : window.location.href
                        )
                    }
                >
                    <Icon className="size-4" icon={Copy01Icon} />
                    Copy Link
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void writeClipboardText(row.message.content)}>
                    <Icon className="size-4" icon={Copy01Icon} />
                    Copy Markdown
                </ContextMenuItem>
                {/* Select Message is deliberately omitted; Electron-native selection owns it. */}
                <ContextMenuSeparator />
                {canOpenThread ? (
                    <ContextMenuItem onClick={openThread}>
                        <Icon className="size-4" icon={BubbleChatIcon} />
                        Open Thread
                    </ContextMenuItem>
                ) : null}
                {thread?.followed && canOpenThread ? (
                    <ContextMenuItem onClick={() => context?.onUnfollowThread(thread.threadChatId)}>
                        <Icon className="size-4" icon={Bookmark01Icon} />
                        Unfollow Thread
                    </ContextMenuItem>
                ) : null}
                {/* Save Message ships with the later bookmarks workstream. */}
                {canOpenThread && !row.message.task && row.message.senderType !== 'system' ? (
                    <ContextMenuItem
                        onClick={() =>
                            convert.mutate({ messageId: row.message.id, origin: 'converted' })
                        }
                    >
                        <Icon className="size-4" icon={Task01Icon} />
                        Convert to Task
                    </ContextMenuItem>
                ) : null}
            </ContextMenuPopup>
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
            {thread && canOpenThread ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <ThreadReplyPill onClick={openThread} summary={thread} />
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
        <div className="absolute -top-3 right-1 z-10 flex items-center rounded-lg border border-border-subtle bg-popover p-0.5 opacity-0 focus-within:opacity-100 group-hover/message-row:opacity-100">
            {canOpenThread ? (
                <button
                    aria-label="Reply in thread"
                    className={actionButtonClassName}
                    onClick={onOpenThread}
                    type="button"
                >
                    <Icon className="size-4" icon={BubbleChatIcon} />
                </button>
            ) : null}
            {reactionsEnabled ? (
                <Popover>
                    <PopoverTrigger aria-label="Add Reaction" className={actionButtonClassName}>
                        <Icon className="size-4" icon={SmileIcon} />
                    </PopoverTrigger>
                    <PopoverPopup align="end" className="w-auto p-1">
                        <QuickReactionStrip onReact={onReact} />
                    </PopoverPopup>
                </Popover>
            ) : null}
        </div>
    );
}

function QuickReactionStrip({ onReact }: { onReact: (emoji: string) => void }) {
    return (
        <div className="flex gap-0.5 p-1">
            {quickReactionEmoji.map((emoji) => (
                <button
                    aria-label={`React with ${emoji}`}
                    className="grid size-7 place-items-center rounded-md hover:bg-accent"
                    key={emoji}
                    onClick={() => onReact(emoji)}
                    type="button"
                >
                    {emoji}
                </button>
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
                                : 'border-border-subtle bg-muted text-muted-foreground'
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
