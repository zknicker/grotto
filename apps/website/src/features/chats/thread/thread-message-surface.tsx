import type { CloudAgentWork } from '@grotto/api';
import { ChatMessage } from '@heroui-pro/react';
import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { TranscriptAskMarker } from '../../asks/transcript-ask-marker.tsx';
import { CloudAgentWorkCard } from '../../cloud-agents/cloud-agent-work-card.tsx';
import {
    CloudAgentWorkDetail,
    CloudAgentWorkHeader,
} from '../../cloud-agents/cloud-agent-work-header.tsx';
import { ThreadCloudAgentRows } from '../../cloud-agents/thread-cloud-agent-rows.tsx';
import {
    TranscriptCloudAgentWorkMenu,
    useHoistedCloudAgentWork,
} from '../../cloud-agents/transcript-cloud-agent-work.tsx';
import { TranscriptTaskChip } from '../../tasks/transcript-task-chip.tsx';
import { ActionTooltip } from '../chat-action-tooltip.tsx';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chat-transcript-render-context.tsx';
import { MessageContextMenu } from './message-context-menu.tsx';
import { MessageReactionPills } from './message-reactions.tsx';
import { isThreadAnchorRow } from './thread-anchor.ts';
import { ThreadPreviewBlock } from './thread-preview-block.tsx';

/**
 * One message's Thread surroundings: the marks for whatever it is, its
 * reactions, any surface-owned block, and the Thread preview.
 *
 * Everything under a Message that carries a lifecycle a reader tracks — the
 * Task it is, the Ask it asks, the Cloud Agent work it launched, and any live
 * work running inside its Thread — reads in the header of the one recessed
 * surface beneath it, in one chip grammar. Provenance stays on the author line:
 * a trigger or reminder fire and a session restart explain how the message came
 * to be said, and neither has a status to follow.
 *
 * Inside a Thread, full Cloud Agent cards follow their delegation Message.
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
    const work = row.message.cloudAgentWork ?? null;
    const works = useHoistedCloudAgentWork(row);
    const hoisted = canOpenThread ? works.filter((item) => item.id !== work?.id) : [];
    const flashing = context?.flashMessageId === row.message.id;
    const messageBlock = context?.renderMessageBlock?.(row.message) ?? null;
    // A Thread opened on a Task states it in full in the metadata panel above
    // the anchor, so the anchor's own chip would repeat every word of it.
    const task =
        context?.taskChipHiddenMessageId === row.message.id ? null : (row.message.task ?? null);
    // A background claim is an Agent's own lock on work it means to finish in
    // one turn. Only its own claimant speaking in its Thread makes it tracked,
    // so a claim can carry a whole conversation of peers and bystanders and
    // still be bookkeeping: the surface holds their replies but withholds the
    // task's title, which would read as a commitment nobody made. Tier decides
    // that title alone; whether the surface appears at all is the Thread's.
    const surfaceTask = task?.tier === 'background' ? null : task;
    const marks = (
        <ThreadSurfaceMarks row={row} task={surfaceTask} work={canOpenThread ? work : null} />
    );
    // The card exists for the marks even before the first reply, so whether
    // there are any decides whether the header carries anything.
    const hasMarks = Boolean(surfaceTask || row.message.ask || work || hoisted.length);
    const showsSurface = threadSurfaceVisible({
        ask: Boolean(row.message.ask),
        hoisted: hoisted.length > 0,
        threadHasMessages: (getTranscriptMessageThread(row)?.replyCount ?? 0) > 0,
        work: Boolean(work),
    });

    return (
        <MessageContextMenu className={cn(flashing && 'chat-thread-flash')} row={row}>
            {children}
            <div className="flex flex-wrap items-center gap-1.5">
                {canOpenThread ? null : marks}
                <MessageReactionPills row={row} />
            </div>
            {messageBlock}
            {work && !canOpenThread ? <CloudAgentWorkCard work={work} /> : null}
            {canOpenThread && showsSurface ? (
                <ThreadPreviewBlock
                    detail={<ThreadSurfaceWorkDetail hoisted={hoisted} work={work} />}
                    headerLabel={threadSurfaceLabel({
                        ask: Boolean(row.message.ask),
                        hoisted: hoisted.length > 0,
                        taskNumber: surfaceTask?.number,
                        workTitle: work?.title,
                    })}
                    headerLeading={
                        hasMarks ? (
                            <span className="flex min-w-0 items-center gap-2">{marks}</span>
                        ) : undefined
                    }
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

function ThreadSurfaceWorkDetail({
    work,
    hoisted,
}: {
    work: CloudAgentWork | null;
    hoisted: readonly CloudAgentWork[];
}) {
    return (
        <>
            {work ? <CloudAgentWorkDetail work={work} /> : null}
            {hoisted.length > 0 ? <ThreadCloudAgentRows works={hoisted} /> : null}
        </>
    );
}

function ThreadSurfaceMarks({
    row,
    task,
    work,
}: {
    row: TranscriptMessageRow;
    task: TranscriptMessageRow['message']['task'];
    work: CloudAgentWork | null;
}) {
    return (
        <>
            {task ? <TranscriptTaskChip row={row} /> : null}
            {row.message.ask ? <TranscriptAskMarker ask={row.message.ask} /> : null}
            {work ? <CloudAgentWorkHeader work={work} /> : null}
        </>
    );
}

/**
 * Whether the recessed surface appears under a message at all.
 *
 * The surface is the Thread's own card, so a Thread that holds anything gets
 * one whatever the anchor's task is: a peer or a bystander replying under a
 * claim is exactly the chatter a Thread exists to hold, and it reads as an
 * ordinary conversation. Before the first reply the card appears only for a
 * mark with nowhere else to sit — an Ask, Cloud Agent work — so a task with an
 * empty Thread renders no surface at all, whatever its tier, its mark in the
 * message header saying the whole of it. An empty card announcing "0 replies"
 * is the one thing the surface must never be.
 */
export function threadSurfaceVisible({
    ask,
    hoisted,
    threadHasMessages,
    work,
}: {
    ask: boolean;
    hoisted: boolean;
    threadHasMessages: boolean;
    work: boolean;
}): boolean {
    return threadHasMessages || ask || work || hoisted;
}

/**
 * What the surface is, for the button that opens it. The marks are laid out
 * beside that button rather than inside it, so their text never reaches its
 * accessible name; this restates the identity, and nothing else — status and
 * assignee are the header's job, and change under a reader who is not looking.
 */
export function threadSurfaceLabel({
    ask,
    hoisted,
    taskNumber,
    workTitle,
}: {
    ask: boolean;
    hoisted: boolean;
    taskNumber?: number;
    workTitle?: string;
}): string | undefined {
    const parts = [
        taskNumber === undefined ? null : `Task #${taskNumber}`,
        ask ? 'Ask' : null,
        workTitle === undefined ? null : `Cloud Agent work: ${workTitle}`,
        hoisted ? 'Cloud Agent work' : null,
    ].filter((part) => part !== null);

    return parts.length === 0 ? undefined : parts.join(', ');
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
