import { Label, toast } from '@heroui/react';
import { ContextMenu } from '@heroui-pro/react';
import {
    Activity01Icon,
    BubbleChatIcon,
    Copy01Icon,
    SmileIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { cn } from '../../../lib/utils.ts';
import {
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { useMessageContextActions } from './message-context-actions.tsx';
import { hasOwnReaction, quickReactionEmoji } from './message-reactions.tsx';
import { isThreadAnchorRow } from './thread-anchor.ts';

export function MessageContextMenu({
    children,
    className,
    row,
}: {
    children: React.ReactNode;
    className?: string;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();
    const messageActions = useMessageContextActions();
    const canReply = Boolean(context?.threadActionsEnabled && isThreadAnchorRow(row));
    const canReact = Boolean(context?.onToggleReaction && isThreadAnchorRow(row));

    const onAction = (key: React.Key) => {
        if (key === 'copy') {
            writeClipboardText(row.message.content)
                .then(() => toast.success('Message copied'))
                .catch(() => toast.danger('Could not copy the message'));
            return;
        }
        if (key === 'reply' && canReply) {
            context?.onOpenThread(row);
            return;
        }
        if (key === 'details') {
            messageActions?.onViewTurnDetails();
            return;
        }
        if (typeof key === 'string' && key.startsWith(reactionPrefix)) {
            const emoji = key.slice(reactionPrefix.length);
            context?.onToggleReaction?.({
                emoji,
                messageId: row.message.id,
                remove: hasOwnReaction(row, emoji),
            });
        }
    };

    return (
        <ContextMenu>
            <ContextMenu.Trigger
                className={cn('group/message-row relative block min-w-0 rounded-lg', className)}
                data-message-id={row.message.id}
            >
                {children}
            </ContextMenu.Trigger>
            <ContextMenu.Popover>
                <ContextMenu.Menu onAction={onAction}>
                    <ContextMenu.Item id="copy" textValue="Copy message">
                        <Icon aria-hidden="true" icon={Copy01Icon} size={16} />
                        <Label>Copy message</Label>
                    </ContextMenu.Item>
                    <ContextMenu.Item id="reply" isDisabled={!canReply} textValue="Reply in thread">
                        <Icon aria-hidden="true" icon={BubbleChatIcon} size={16} />
                        <Label>Reply in thread</Label>
                    </ContextMenu.Item>
                    {messageActions ? (
                        <ContextMenu.Item id="details" textValue="View turn details">
                            <Icon aria-hidden="true" icon={Activity01Icon} size={16} />
                            <Label>View turn details</Label>
                        </ContextMenu.Item>
                    ) : null}
                    <ContextMenu.SubmenuTrigger>
                        <ContextMenu.Item
                            id="reactions"
                            isDisabled={!canReact}
                            textValue="Add reaction"
                        >
                            <Icon aria-hidden="true" icon={SmileIcon} size={16} />
                            <Label>Add reaction</Label>
                            <ContextMenu.SubmenuIndicator />
                        </ContextMenu.Item>
                        <ContextMenu.Popover>
                            <ContextMenu.Menu onAction={onAction}>
                                {quickReactionEmoji.map((emoji) => (
                                    <ContextMenu.Item
                                        id={`${reactionPrefix}${emoji}`}
                                        key={emoji}
                                        textValue={`React with ${emoji}`}
                                    >
                                        <span aria-hidden="true" className="w-4 text-center">
                                            {emoji}
                                        </span>
                                        <Label>React with {emoji}</Label>
                                    </ContextMenu.Item>
                                ))}
                            </ContextMenu.Menu>
                        </ContextMenu.Popover>
                    </ContextMenu.SubmenuTrigger>
                </ContextMenu.Menu>
            </ContextMenu.Popover>
        </ContextMenu>
    );
}

const reactionPrefix = 'reaction:';
