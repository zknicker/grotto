import { ChatMessage } from '@heroui-pro/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { TranscriptAskMarker } from '../../asks/transcript-ask-marker.tsx';
import { ActionTooltip } from '../chat-action-tooltip.tsx';
import {
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { MessageContextMenu } from './message-context-menu.tsx';
import { MessageReactionPills } from './message-reactions.tsx';
import { isThreadAnchorRow } from './thread-anchor.ts';
import { ThreadPreviewBlock } from './thread-preview-block.tsx';

/**
 * One message's Thread surroundings: its Ask marker, its reactions, any
 * surface-owned block, and the Thread preview once the Thread has replies.
 * The message's own task identity is a header mark, not a block down here.
 */
export function ThreadMessageSurface({
    children,
    row,
}: {
    children: React.ReactNode;
    row: TranscriptMessageRow;
}) {
    const context = useTranscriptRenderContextOptional();
    const canOpenThread = Boolean(context?.threadActionsEnabled && isThreadAnchorRow(row));
    const flashing = context?.flashMessageId === row.message.id;
    const messageBlock = context?.renderMessageBlock?.(row.message) ?? null;

    return (
        <MessageContextMenu className={cn(flashing && 'chat-thread-flash')} row={row}>
            {children}
            <div className="flex flex-wrap items-center gap-1.5">
                {row.message.ask ? <TranscriptAskMarker ask={row.message.ask} /> : null}
                <MessageReactionPills row={row} />
            </div>
            {messageBlock}
            {canOpenThread ? <ThreadPreviewBlock row={row} /> : null}
        </MessageContextMenu>
    );
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

export { isThreadAnchorRow } from './thread-anchor.ts';
