import * as React from 'react';
import type { ActorProfile } from '../../hooks/actors/use-actor.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import type { TranscriptMessage } from './chat-transcript-message.tsx';
import type {
    ConversationMessageLayout,
    TranscriptActor,
    TranscriptRow,
} from './chat-transcript-model.ts';

export type TranscriptMessageRow = Extract<TranscriptRow, { kind: 'message' }>;
export type TranscriptThreadSummary = NonNullable<
    Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['thread']
>;

export function getTranscriptMessageThread(
    row: TranscriptMessageRow
): TranscriptThreadSummary | null {
    return 'thread' in row ? (row.thread ?? null) : null;
}

export interface TranscriptRenderContextValue {
    canRequestMention: boolean;
    chatId?: string;
    composerId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    disableAgentHoverCard?: boolean;
    flashMessageId: string | null;
    hiddenCount: number;
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
    renderMessageContent?: (message: TranscriptMessage) => React.ReactNode;
    /** Runs whose final reply is present anywhere in the transcript. */
    repliedRunIds: ReadonlySet<string>;
    resolveActorProfile?: (actor: TranscriptActor) => ActorProfile | null;
    /**
     * Whether an item mounting now lands at the live edge and should animate
     * in. False for everything present at first render and for older history
     * pages loading in.
     */
    shouldAnimateItemEnter: (key: string, timestampMs: number | null) => boolean;
    threadActionsEnabled: boolean;
    turnEvidenceSource?: 'embedded' | 'runtime';
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
