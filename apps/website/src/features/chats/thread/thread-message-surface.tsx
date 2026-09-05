import { ChatMessage } from '@heroui-pro/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { TranscriptAskMarker } from '../../asks/transcript-ask-marker.tsx';
import {
    CloudAgentWorkDetail,
    CloudAgentWorkHeader,
} from '../../cloud-agents/cloud-agent-work-header.tsx';
import {
    TranscriptCloudAgentWorkBlock,
    TranscriptCloudAgentWorkMenu,
} from '../../cloud-agents/transcript-cloud-agent-work.tsx';
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
 * Cloud Agent work brings its own header, detail, and menu, so it rides the
 * preview card even before the first reply.
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
    // The Thread pane's metadata panel states the anchor's work in full, so
    // that row carries no compact header of its own.
    const work =
        context?.cloudAgentWorkHeaderHiddenMessageId === row.message.id
            ? null
            : (row.message.cloudAgentWork ?? null);
    const workLivesInPreview = Boolean(work && canOpenThread);
    const flashing = context?.flashMessageId === row.message.id;
    const messageBlock = context?.renderMessageBlock?.(row.message) ?? null;

    return (
        <MessageContextMenu className={cn(flashing && 'chat-thread-flash')} row={row}>
            {children}
            <div className="flex flex-wrap items-center gap-1.5">
                {work && !workLivesInPreview ? (
                    <TranscriptCloudAgentWorkBlock row={row} work={work} />
                ) : null}
                {row.message.ask ? <TranscriptAskMarker ask={row.message.ask} /> : null}
                <MessageReactionPills row={row} />
            </div>
            {messageBlock}
            {canOpenThread ? (
                <ThreadPreviewBlock
                    detail={work ? <CloudAgentWorkDetail work={work} /> : undefined}
                    headerLeading={work ? <CloudAgentWorkHeader work={work} /> : undefined}
                    headerTrailing={
                        work ? (
                            <TranscriptCloudAgentWorkMenu
                                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/thread:opacity-100 aria-expanded:opacity-100"
                                row={row}
                                work={work}
                            />
                        ) : undefined
                    }
                    row={row}
                />
            ) : null}
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
