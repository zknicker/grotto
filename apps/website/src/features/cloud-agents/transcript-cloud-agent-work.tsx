import type { CloudAgentWork } from '@grotto/api';
import {
    type TranscriptMessageRow,
    useTranscriptRenderContextOptional,
} from '../chats/chat-transcript-render-context.tsx';
import { isThreadAnchorRow } from '../chats/thread/thread-anchor.ts';
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
 * The live Cloud Agent work running inside this Message's Thread, if any. The
 * transcript surface owns the read and hands it down through the render
 * context, so a row stays a row: it looks its own Message up, and learns
 * nothing about where active work comes from.
 */
export function useHoistedCloudAgentWork(row: TranscriptMessageRow): CloudAgentWork | null {
    const context = useTranscriptRenderContextOptional();
    return context?.hoistedCloudAgentWork?.get(row.message.id) ?? null;
}
