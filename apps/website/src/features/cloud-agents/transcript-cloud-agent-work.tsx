import type { CloudAgentWork } from '@grotto/api';
import {
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chats/chat-transcript-render-context.tsx';
import { isThreadAnchorRow } from '../chats/thread/thread-anchor.ts';
import { CloudAgentWorkDetail, CloudAgentWorkHeader } from './cloud-agent-work-header.tsx';
import { CloudAgentWorkMenu } from './cloud-agent-work-menu.tsx';

/**
 * The work's overflow menu as a transcript row hosts it. The Chat a copied
 * link points at is the conversation the transcript belongs to, so work
 * launched inside a Thread still links somewhere a reader can open.
 */
export function TranscriptCloudAgentWorkMenu({
    className,
    row,
    work,
}: {
    className?: string;
    row: TranscriptMessageRow;
    work: CloudAgentWork;
}) {
    const context = useTranscriptRenderContextOptional();
    const conversationChatId = context?.conversationChatId ?? context?.chatId;

    if (!(context && conversationChatId)) {
        return null;
    }

    // The same rule the surface itself uses: inside a Thread there is no
    // Thread to open, so the menu does not offer one.
    const canOpenThread = context.threadActionsEnabled && isThreadAnchorRow(row);

    return (
        <CloudAgentWorkMenu
            className={className}
            conversationChatId={conversationChatId}
            onOpenThread={canOpenThread ? () => context.onOpenThread(row) : undefined}
            work={work}
        />
    );
}

/**
 * The work as it reads where there is no recessed Thread surface to host it:
 * inside a Thread, where the Message is a reply and has no reply previews of
 * its own. Same header, same one muted line, same menu.
 */
export function TranscriptCloudAgentWorkBlock({
    row,
    work,
}: {
    row: TranscriptMessageRow;
    work: CloudAgentWork;
}) {
    return (
        <div className="group/cloud-agent-work flex w-full min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1">
                <CloudAgentWorkHeader work={work} />
                <TranscriptCloudAgentWorkMenu
                    className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/cloud-agent-work:opacity-100 aria-expanded:opacity-100"
                    row={row}
                    work={work}
                />
            </div>
            <CloudAgentWorkDetail work={work} />
        </div>
    );
}
