import * as React from 'react';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/chats/message-scroller.tsx';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatScrollPositionMemory } from './chat-scroll-position-memory.tsx';
import { ChatTimeline } from './chat-timeline.tsx';
import { ChatTranscriptLoadingIndicator } from './chat-transcript-loading-indicator.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatDetailFrame({
    activeReplies,
    canRequestMention = true,
    chatId,
    conversationLayout,
    defaultOpenWorkGroups = false,
    emptyLabel,
    error,
    body,
    fetchOlderHistory,
    footer,
    hasOlderHistory = false,
    header,
    historyLoaded,
    hasTransientTimelineContent = false,
    isFetchingOlderHistory = false,
    isPending,
    rows,
    timelineContent,
    totalMessages,
}: {
    activeReplies: readonly ChatActiveReply[];
    canRequestMention?: boolean;
    chatId: string;
    conversationLayout?: ConversationMessageLayout;
    defaultOpenWorkGroups?: boolean;
    emptyLabel: string;
    error?: unknown;
    body?: React.ReactNode;
    fetchOlderHistory?: () => void;
    footer: React.ReactNode;
    hasOlderHistory?: boolean;
    header?: React.ReactNode;
    historyLoaded: boolean;
    hasTransientTimelineContent?: boolean;
    isFetchingOlderHistory?: boolean;
    isPending: boolean;
    rows: NonNullable<ChatLogOutput>['rows'];
    timelineContent?: (scrollContentRef: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
    totalMessages: number;
}) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const hasActiveReply = activeReplies.length > 0;
    const hasTimelineContent = chatTimelineHasContent({
        activeReplyCount: activeReplies.length,
        hasTransientTimelineContent,
        rowCount: rows.length,
    });
    const isInitialTranscriptPending = isPending && !historyLoaded && !hasActiveReply;
    const handleScroll = () => {
        const viewport = viewportRef.current;

        if (!viewport || viewport.scrollTop > 160 || !hasOlderHistory || isFetchingOlderHistory) {
            return;
        }

        fetchOlderHistory?.();
    };

    return (
        <MessageScrollerProvider autoScroll={hasTimelineContent} defaultScrollPosition="end">
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="relative flex min-w-0 flex-1 flex-col">
                    {header}
                    {body === undefined ? (
                        <div className="relative min-h-0 flex-1">
                            <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2">
                                <ChatTranscriptLoadingIndicator
                                    className="shrink-0"
                                    visible={isInitialTranscriptPending}
                                />
                            </div>
                            <MessageScroller>
                                <MessageScrollerViewport
                                    // The conversation hugs the composer — the
                                    // bottom padding (96px) is static clearance
                                    // for a two-row floating status stack. New
                                    // sends append here without re-anchoring the
                                    // viewport, so the history above stays put.
                                    className="px-5 pt-4 pb-24"
                                    onScroll={handleScroll}
                                    ref={viewportRef}
                                >
                                    {isInitialTranscriptPending ? null : error ? (
                                        <MessageScrollerContent className="w-full">
                                            <div className="px-2 py-4 text-muted text-sm">
                                                Unable to load this chat transcript right now.
                                            </div>
                                        </MessageScrollerContent>
                                    ) : hasTimelineContent ? (
                                        timelineContent ? (
                                            timelineContent(contentRef)
                                        ) : (
                                            <ChatTimeline
                                                canRequestMention={canRequestMention}
                                                chatId={chatId}
                                                conversationLayout={conversationLayout}
                                                defaultOpenWorkGroups={defaultOpenWorkGroups}
                                                rows={rows}
                                                scrollContentRef={contentRef}
                                                totalMessages={totalMessages}
                                            />
                                        )
                                    ) : (
                                        <MessageScrollerContent className="w-full">
                                            <div className="px-2 py-4 text-muted text-sm">
                                                {emptyLabel}
                                            </div>
                                        </MessageScrollerContent>
                                    )}
                                </MessageScrollerViewport>
                                <ChatScrollPositionMemory
                                    chatId={chatId}
                                    enabled={hasTimelineContent && !isInitialTranscriptPending}
                                    key={chatId}
                                    viewportRef={viewportRef}
                                />
                                {hasTimelineContent ? (
                                    <MessageScrollerButton
                                        aria-label="Jump to latest message"
                                        className="z-10"
                                        direction="end"
                                    />
                                ) : null}
                            </MessageScroller>
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
                    )}

                    {footer}
                </div>
            </div>
        </MessageScrollerProvider>
    );
}

export function chatTimelineHasContent(input: {
    activeReplyCount: number;
    hasTransientTimelineContent: boolean;
    rowCount: number;
}) {
    return input.rowCount > 0 || input.activeReplyCount > 0 || input.hasTransientTimelineContent;
}
