import * as React from 'react';
import type { TranscriptMessage } from './chat-transcript-message.tsx';
import type { ConversationMessageLayout, TranscriptActor } from './chat-transcript-model.ts';
import type { SessionMark } from './session/session-mark-model.ts';
import type {
    TranscriptActorProfile,
    TranscriptMessageRow,
    TranscriptThreadSummary,
} from './transcript-contract.ts';

export type { TranscriptMessageRow } from './transcript-contract.ts';

export function getTranscriptMessageThread(
    row: TranscriptMessageRow
): TranscriptThreadSummary | null {
    return 'thread' in row ? (row.thread ?? null) : null;
}

/**
 * Resolves the text a message's Copy action should place on the clipboard,
 * via the render context's optional `messageCopyText`, falling back to the
 * message's own content when the context is missing the override (or missing
 * entirely).
 */
export function getMessageCopyText(
    context: TranscriptRenderContextValue | null | undefined,
    message: TranscriptMessage
): string {
    return context?.messageCopyText?.(message) ?? message.content;
}

export interface TranscriptRenderContextValue {
    canRequestMention: boolean;
    /**
     * Suppresses the header's automation mark. A Thread opened on a caused
     * message states the automation, its status, and the fire in the context
     * card above the anchor, so repeating the mark on the anchor's own header
     * says the same thing twice.
     */
    causeMarkHidden?: boolean;
    chatId?: string;
    composerId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    flashMessageId: string | null;
    hiddenCount: number;
    /**
     * The text a message's Copy action writes to the clipboard. Absent by
     * default, in which case `getMessageCopyText` falls back to the raw
     * `message.content` — correct for an ordinary message, but not for a
     * prepared-action anchor, whose Server-stored content is empty because
     * `renderMessageBlock` renders its real body instead.
     */
    messageCopyText?: (message: TranscriptMessage) => string;
    onActorClick?: (actor: TranscriptActor) => void;
    onOpenThread: (row: TranscriptMessageRow) => void;
    /**
     * Toggles the viewer's emoji reaction on a message. Absent when the
     * surface has no reaction support; all reaction UI hides with it.
     */
    onToggleReaction?: (input: { emoji: string; messageId: string; remove: boolean }) => void;
    onUnfollowThread: (threadChatId: string) => void;
    profilePaneChatId?: string;
    renderMessageAttachments?: (message: TranscriptMessage) => React.ReactNode;
    /**
     * A surface-owned block that belongs to one message but is not its body —
     * a prepared-action card today. It mounts under the message and its
     * attachments, beside the thread preview, so the transcript layer never
     * learns what any one block is.
     */
    renderMessageBlock?: (message: TranscriptMessage) => React.ReactNode;
    renderMessageContent?: (message: TranscriptMessage) => React.ReactNode;
    /** Runs whose final reply is present anywhere in the transcript. */
    repliedRunIds: ReadonlySet<string>;
    resolveActorProfile?: (actor: TranscriptActor) => TranscriptActorProfile | null;
    /**
     * Messages that opened a new Agent session, by message id. Derived across
     * the whole loaded transcript rather than per row, because the rule is a
     * difference between one Agent message and that Agent's previous one.
     */
    sessionMarks?: ReadonlyMap<string, SessionMark>;
    /**
     * Whether an item mounting now lands at the live edge and should animate
     * in. False for everything present at first render and for older history
     * pages loading in.
     */
    shouldAnimateItemEnter: (key: string, timestampMs: number | null) => boolean;
    /**
     * Suppresses the per-message task chip. The task dialog states the task's
     * number, status, and assignee in its metadata panel, so the anchor's chip
     * would repeat all three.
     */
    taskChipHidden?: boolean;
    threadActionsEnabled: boolean;
    turnDetails?: {
        access: 'journal' | 'summary';
        serverId: string;
    };
}

const TranscriptRenderContext = React.createContext<TranscriptRenderContextValue | null>(null);

export function TranscriptRenderProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: TranscriptRenderContextValue;
}) {
    return <TranscriptRenderContext value={value}>{children}</TranscriptRenderContext>;
}

export function useTranscriptRenderContext() {
    const context = React.useContext(TranscriptRenderContext);

    if (!context) {
        throw new Error('Transcript render context is missing.');
    }

    return context;
}

// Turn content also renders outside the transcript pane (the turn drawer),
// where no render context exists and enter animation never applies.
export function useTranscriptRenderContextOptional() {
    return React.useContext(TranscriptRenderContext);
}
