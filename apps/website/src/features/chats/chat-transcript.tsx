import type { AgentCharacter } from '@tavern/api/agent-appearance';
import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/chats/message-scroller.tsx';
import { useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import { useMessageFlash } from '../../hooks/threads/use-message-flash.ts';
import { openThreadPane, useThreadPane } from '../../hooks/threads/use-thread-pane.ts';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { trpc } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { ChatCompositionBubbles } from './chat-composition-bubble.tsx';
import { getTranscriptItemKey } from './chat-transcript-item-utils.ts';
import {
    buildTranscriptEntries,
    type ConversationMessageLayout,
    getRepliedRunIds,
    type TranscriptRow,
} from './chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    resolveTranscriptInteractionHosts,
    type TranscriptRenderContextValue,
    TranscriptRenderProvider,
} from './chat-transcript-render-context.tsx';
import {
    buildTranscriptRenderRows,
    computeStableTranscriptRenderRows,
    type StableTranscriptRenderRowsState,
} from './chat-transcript-row-model.ts';
import { TranscriptRenderRowItem } from './chat-transcript-rows.tsx';

const directConversationMessageLayout: ConversationMessageLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
};

export function ChatTranscript({
    agentStatusCharacter = null,
    canRequestMention = true,
    chatId,
    compositionTarget,
    composerId,
    conversationLayout = directConversationMessageLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    hiddenCount = 0,
    leadingContent,
    olderHistory,
    profilePaneChatId,
    rows,
    scrollContentRef,
    threadActionsEnabled = true,
    viewportClassName,
}: {
    agentStatusCharacter?: AgentCharacter | null;
    canRequestMention?: boolean;
    chatId?: string;
    compositionTarget?: string | null;
    composerId?: string;
    conversationLayout?: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    hiddenCount?: number;
    leadingContent?: React.ReactNode;
    // Standalone-viewport transcripts (the thread pane) page older history
    // themselves; embedded transcripts leave paging to their outer frame.
    olderHistory?: { fetch: () => void; hasMore: boolean; isFetching: boolean };
    profilePaneChatId?: string;
    rows: TranscriptRow[];
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    threadActionsEnabled?: boolean;
    viewportClassName?: string;
}) {
    const threadPane = useThreadPane(chatId ?? '');
    const activeSidePane = useChatSidePane(chatId ?? '');
    const flashMessageId = useMessageFlash(chatId ?? '');
    const unfollowThread = trpc.thread.setFollow.useMutation();
    const interactionHosts = resolveTranscriptInteractionHosts({
        chatId,
        composerId,
        profilePaneChatId,
    });
    const mutateThreadFollow = unfollowThread.mutate;
    const entries = React.useMemo(() => buildTranscriptEntries({ rows }), [rows]);
    const rawTranscriptRows = React.useMemo(
        () => buildTranscriptRenderRows(entries, hiddenCount),
        [entries, hiddenCount]
    );
    const transcriptRows = useStableTranscriptRenderRows(rawTranscriptRows);
    const latestAgentMessage = React.useMemo(() => getLatestAgentMessage(rows), [rows]);
    // The durable message's compositionId echo is the commit signal for a
    // provisional composition bubble (specs/chat-timeline.md).
    const messageCompositionIds = React.useMemo(() => getMessageCompositionIds(rows), [rows]);
    // Sticky across renders: the completion handoff can clear the live reply
    // a beat before the durable reply row lands, and narration must not flash
    // back into the pane during that gap.
    const seenRepliedRunsRef = React.useRef(new Set<string>());
    const repliedRunIds = React.useMemo(() => {
        for (const runId of getRepliedRunIds(rows)) {
            seenRepliedRunsRef.current.add(runId);
        }

        return new Set(seenRepliedRunsRef.current);
    }, [rows]);
    const shouldAnimateItemEnter = useLiveEdgeItemEnter(chatId, transcriptRows);
    const onOpenThread = React.useCallback(
        (row: Parameters<TranscriptRenderContextValue['onOpenThread']>[0]) => {
            if (!chatId) {
                return;
            }

            openThreadPane(chatId, {
                anchorMessageId: row.message.id,
                threadChatId: getTranscriptMessageThread(row)?.threadChatId ?? null,
            });
        },
        [chatId]
    );
    const onUnfollowThread = React.useCallback(
        (threadChatId: string) => mutateThreadFollow({ follow: false, threadChatId }),
        [mutateThreadFollow]
    );
    const renderContext = React.useMemo(
        () =>
            ({
                canRequestMention,
                chatId,
                composerId: interactionHosts.composerId,
                activeThreadAnchorId:
                    activeSidePane === 'thread' ? (threadPane?.anchorMessageId ?? null) : null,
                conversationLayout,
                currentSessionKey,
                defaultOpenWorkGroups,
                flashMessageId,
                hiddenCount,
                onOpenThread,
                onUnfollowThread,
                profilePaneChatId: interactionHosts.profilePaneChatId,
                repliedRunIds,
                shouldAnimateItemEnter,
                threadActionsEnabled: threadActionsEnabled && Boolean(chatId),
            }) satisfies TranscriptRenderContextValue,
        [
            canRequestMention,
            chatId,
            interactionHosts.composerId,
            activeSidePane,
            threadPane?.anchorMessageId,
            conversationLayout,
            currentSessionKey,
            defaultOpenWorkGroups,
            flashMessageId,
            hiddenCount,
            onOpenThread,
            onUnfollowThread,
            interactionHosts.profilePaneChatId,
            repliedRunIds,
            shouldAnimateItemEnter,
            threadActionsEnabled,
        ]
    );

    React.useEffect(() => {
        if (!latestAgentMessage) {
            return;
        }

        markChatTiming('final-message-visible', {
            messageId: latestAgentMessage.id,
            sessionKey: latestAgentMessage.sourceSessionKey,
        });
    }, [latestAgentMessage]);

    const transcript = (
        <ChatTranscriptRowsPresentation
            agentStatusCharacter={agentStatusCharacter}
            composition={
                chatId ? (
                    <ChatCompositionBubbles
                        chatId={chatId}
                        compositionTarget={compositionTarget}
                        messageCompositionIds={messageCompositionIds}
                    />
                ) : null
            }
            leadingContent={leadingContent}
            renderContext={renderContext}
            scrollContentRef={scrollContentRef}
            transcriptRows={transcriptRows}
        />
    );

    if (!scrollContentRef) {
        const handleViewportScroll = (event: React.UIEvent<HTMLDivElement>) => {
            if (
                !olderHistory ||
                event.currentTarget.scrollTop > 160 ||
                !olderHistory.hasMore ||
                olderHistory.isFetching
            ) {
                return;
            }
            olderHistory.fetch();
        };

        return (
            <MessageScrollerProvider defaultScrollPosition="end">
                <MessageScroller>
                    <MessageScrollerViewport
                        className={cn(viewportClassName)}
                        onScroll={handleViewportScroll}
                    >
                        {transcript}
                    </MessageScrollerViewport>
                </MessageScroller>
            </MessageScrollerProvider>
        );
    }

    return transcript;
}

export function ChatTranscriptPresentation({
    agentStatusCharacter = null,
    composition,
    leadingContent,
    renderContext,
    rows,
    scrollContentRef,
}: {
    agentStatusCharacter?: AgentCharacter | null;
    composition?: React.ReactNode;
    leadingContent?: React.ReactNode;
    renderContext: TranscriptRenderContextValue;
    rows: TranscriptRow[];
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const entries = React.useMemo(() => buildTranscriptEntries({ rows }), [rows]);
    const rawTranscriptRows = React.useMemo(
        () => buildTranscriptRenderRows(entries, renderContext.hiddenCount),
        [entries, renderContext.hiddenCount]
    );
    const transcriptRows = useStableTranscriptRenderRows(rawTranscriptRows);

    return (
        <ChatTranscriptRowsPresentation
            agentStatusCharacter={agentStatusCharacter}
            composition={composition}
            leadingContent={leadingContent}
            renderContext={renderContext}
            scrollContentRef={scrollContentRef}
            transcriptRows={transcriptRows}
        />
    );
}

function ChatTranscriptRowsPresentation({
    agentStatusCharacter,
    composition,
    leadingContent,
    renderContext,
    scrollContentRef,
    transcriptRows,
}: {
    agentStatusCharacter: AgentCharacter | null;
    composition?: React.ReactNode;
    leadingContent?: React.ReactNode;
    renderContext: TranscriptRenderContextValue;
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    transcriptRows: ReturnType<typeof buildTranscriptRenderRows>;
}) {
    return (
        <TranscriptRenderProvider value={renderContext}>
            <div className="relative min-h-full w-full">
                <MessageScrollerContent className="w-full gap-2" ref={scrollContentRef}>
                    {leadingContent}
                    {transcriptRows.map((row) =>
                        row.kind === 'hiddenCount' && renderContext.hiddenCount === 0 ? null : (
                            <MessageScrollerItem
                                // Drop paint containment so a message's hover
                                // action island can sit on top of the row
                                // without being clipped, keeping rows tight.
                                className="![content-visibility:visible]"
                                key={row.id}
                                messageId={row.id}
                            >
                                <TranscriptRenderRowItem
                                    agentStatusCharacter={agentStatusCharacter}
                                    row={row}
                                />
                            </MessageScrollerItem>
                        )
                    )}
                    {composition}
                </MessageScrollerContent>
            </div>
        </TranscriptRenderProvider>
    );
}

// Pagination timestamps are minutes-to-months old; live rows land within
// moments of the client clock. The slack absorbs modest clock skew between
// the client and a remote runtime host.
const liveEdgeEnterSlackMs = 60 * 1000;

// Items present at first render (or restored when switching back to a chat)
// must not animate; only items that mount afterwards with a live timestamp
// read as arrivals. Keyed per chat so a chat switch re-seeds the baseline.
function useLiveEdgeItemEnter(
    chatId: string | undefined,
    transcriptRows: ReturnType<typeof buildTranscriptRenderRows>
) {
    const stateRef = React.useRef<{
        chatId: string | undefined;
        mountedAtMs: number;
        ready: boolean;
        seen: Set<string>;
    }>({ chatId, mountedAtMs: Date.now(), ready: false, seen: new Set() });

    if (stateRef.current.chatId !== chatId) {
        stateRef.current = {
            chatId,
            mountedAtMs: Date.now(),
            ready: false,
            seen: new Set(),
        };
    }

    React.useEffect(() => {
        const state = stateRef.current;

        for (const row of transcriptRows) {
            if (row.kind !== 'entry' || row.entry.kind === 'system') {
                continue;
            }

            for (const item of row.entry.items) {
                state.seen.add(getTranscriptItemKey(item));
            }
        }

        state.ready = true;
    }, [transcriptRows]);

    return React.useCallback((key: string, timestampMs: number | null) => {
        const state = stateRef.current;

        return (
            state.ready &&
            !state.seen.has(key) &&
            (timestampMs === null || timestampMs >= state.mountedAtMs - liveEdgeEnterSlackMs)
        );
    }, []);
}

function useStableTranscriptRenderRows(rows: ReturnType<typeof buildTranscriptRenderRows>) {
    const stateRef = React.useRef<StableTranscriptRenderRowsState>({
        byId: new Map(),
        result: [],
    });

    return React.useMemo(() => {
        const nextState = computeStableTranscriptRenderRows(rows, stateRef.current);
        stateRef.current = nextState;
        return nextState.result;
    }, [rows]);
}

function getMessageCompositionIds(rows: TranscriptRow[]) {
    const ids = new Set<string>();

    for (const row of rows) {
        if (row.kind !== 'message') {
            continue;
        }

        const compositionId = row.message.metadata?.compositionId;
        if (typeof compositionId === 'string') {
            ids.add(compositionId);
        }
    }

    return ids;
}

function getLatestAgentMessage(rows: TranscriptRow[]) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row?.kind === 'message' && row.message.senderType === 'agent') {
            return row.message;
        }
    }

    return null;
}
