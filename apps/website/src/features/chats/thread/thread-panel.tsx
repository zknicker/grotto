import { useMessageScroller } from '../../../components/ui/message-scroller.tsx';
import { useChatTimeline } from '../../../hooks/chats/use-chat-timeline.ts';
import { flashMessage } from '../../../hooks/threads/use-message-flash.ts';
import { useMarkThreadReadOnView } from '../../../hooks/threads/use-thread-mark-read.ts';
import { closeThreadPane, type ThreadPaneState } from '../../../hooks/threads/use-thread-pane.ts';
import type { AgentListOutput, ChatLogOutput } from '../../../lib/trpc.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import { ArchivedChatBar } from '../archived-chat-bar.tsx';
import { getActiveRunIds } from '../chat-active-runs.ts';
import type { ChatListItem } from '../chat-list-data.ts';
import { ChatMessageComposer } from '../chat-message-composer.tsx';
import { getChatMessageLayout } from '../chat-message-layout.ts';
import { ChatSidePaneShell } from '../chat-side-pane-shell.tsx';
import { ChatTranscript } from '../chat-transcript.tsx';
import { buildTranscriptEntries, type TranscriptItem } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
} from '../chat-transcript-render-context.tsx';
import { ThreadAnchorMessage } from './thread-anchor-message.tsx';
import { ThreadPanelHeader } from './thread-panel-header.tsx';
import { threadPaneTitles } from './thread-target.ts';

const threadLogLimit = 48;

export function ThreadPanel({
    agents,
    chat,
    open,
    parentRows,
    state,
    takeover = false,
}: {
    agents: AgentListOutput['agents'];
    chat: ChatListItem;
    open: boolean;
    parentRows: NonNullable<ChatLogOutput>['rows'];
    state: ThreadPaneState | null;
    takeover?: boolean;
}) {
    const scroller = useMessageScroller();
    const follow = trpc.thread.setFollow.useMutation();
    const anchorRow = state ? findAnchorRow(parentRows, state.anchorMessageId) : null;
    const thread = anchorRow ? getTranscriptMessageThread(anchorRow) : null;
    const threadChatId = state?.threadChatId ?? thread?.threadChatId ?? null;
    const titles = state ? threadPaneTitles(chat, state.anchorMessageId) : null;

    if (!(state && titles)) {
        return null;
    }

    // The anchor lives outside the loaded parent window (older history after
    // a reload): keep the pane openable/closable instead of vanishing — a
    // null render would blank the narrow-width takeover entirely.
    if (!anchorRow) {
        return (
            <ChatSidePaneShell label="Thread" open={open} takeover={takeover}>
                {(width) => (
                    <div
                        className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
                        style={width ? { width } : undefined}
                    >
                        <ThreadPanelHeader
                            followed={false}
                            followPending={false}
                            header={titles.header}
                            onBack={() => closeThreadPane(chat.id)}
                            onClose={() => closeThreadPane(chat.id)}
                            onFollowChange={() => undefined}
                            onViewInChannel={() => closeThreadPane(chat.id)}
                            takeover={takeover}
                            target={titles.target}
                            threadExists={false}
                        />
                        <div className="flex flex-1 items-center justify-center px-6 text-center text-muted-foreground text-sm">
                            The thread's first message isn't loaded here. Scroll the channel back to
                            it, then reopen the thread.
                        </div>
                    </div>
                )}
            </ChatSidePaneShell>
        );
    }

    const close = () => closeThreadPane(chat.id);
    const viewInChannel = () => {
        const entryId = findAnchorEntryId(parentRows, state.anchorMessageId);
        close();

        if (!entryId) {
            return;
        }

        scrollToAnchor(scroller, entryId, () => flashMessage(chat.id, state.anchorMessageId));
    };

    return (
        <ChatSidePaneShell label="Thread" open={open} takeover={takeover}>
            {(width) => (
                <div
                    className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
                    style={width ? { width } : undefined}
                >
                    <ThreadPanelHeader
                        followed={thread?.followed ?? false}
                        followPending={follow.isPending}
                        header={titles.header}
                        onBack={close}
                        onClose={close}
                        onFollowChange={(next) => {
                            if (threadChatId) {
                                follow.mutate({ follow: next, threadChatId });
                            }
                        }}
                        onViewInChannel={viewInChannel}
                        takeover={takeover}
                        target={titles.target}
                        threadExists={threadChatId !== null}
                    />
                    {threadChatId ? (
                        <SyncedThreadBody
                            agents={agents}
                            anchorMessageId={state.anchorMessageId}
                            anchorRow={anchorRow}
                            chat={chat}
                            compositionTarget={titles.target}
                            open={open}
                            replyCount={thread?.replyCount ?? 0}
                            threadChatId={threadChatId}
                        />
                    ) : (
                        <>
                            <div className="min-h-0 flex-1">
                                <ChatTranscript
                                    leadingContent={
                                        <ThreadLeadingContent
                                            anchorRow={anchorRow}
                                            replyCount={0}
                                        />
                                    }
                                    rows={[]}
                                    threadActionsEnabled={false}
                                    viewportClassName="px-5 pb-6"
                                />
                            </div>
                            <ThreadComposerFooter
                                agents={agents}
                                anchorMessageId={state.anchorMessageId}
                                chat={chat}
                            />
                        </>
                    )}
                </div>
            )}
        </ChatSidePaneShell>
    );
}

function SyncedThreadBody({
    agents,
    anchorMessageId,
    anchorRow,
    chat,
    compositionTarget,
    open,
    replyCount,
    threadChatId,
}: {
    agents: AgentListOutput['agents'];
    anchorMessageId: string;
    anchorRow: TranscriptMessageRow;
    chat: ChatListItem;
    compositionTarget: string | null;
    open: boolean;
    replyCount: number;
    threadChatId: string;
}) {
    const timeline = useChatTimeline({ chatId: threadChatId, limit: threadLogLimit });
    useMarkThreadReadOnView({ enabled: open, parentChatId: chat.id, threadChatId });

    return (
        <>
            <div className="min-h-0 flex-1">
                <ChatTranscript
                    canRequestMention={!chat.archived}
                    chatId={threadChatId}
                    composerId={`${chat.id}:thread:${anchorMessageId}`}
                    compositionTarget={compositionTarget}
                    conversationLayout={getChatMessageLayout(chat)}
                    leadingContent={
                        <ThreadLeadingContent anchorRow={anchorRow} replyCount={replyCount} />
                    }
                    olderHistory={{
                        fetch: timeline.fetchOlderHistory,
                        hasMore: timeline.hasOlderHistory,
                        isFetching: timeline.isFetchingOlderHistory,
                    }}
                    profilePaneChatId={chat.id}
                    rows={timeline.rows}
                    threadActionsEnabled={false}
                    viewportClassName="px-5 pb-6"
                />
            </div>
            <ThreadComposerFooter
                activeRunIds={getActiveRunIds(timeline)}
                agents={agents}
                anchorMessageId={anchorMessageId}
                chat={chat}
                isReplyActive={timeline.activeReplies.length > 0}
                stopChatId={threadChatId}
            />
        </>
    );
}

function ThreadComposerFooter({
    activeRunIds = [],
    agents,
    anchorMessageId,
    chat,
    isReplyActive = false,
    stopChatId,
}: {
    activeRunIds?: readonly string[];
    agents: AgentListOutput['agents'];
    anchorMessageId: string;
    chat: ChatListItem;
    isReplyActive?: boolean;
    stopChatId?: string;
}) {
    if (chat.archived) {
        return (
            <div className="shrink-0 border-[var(--content-card-border)] border-t pt-3">
                <ArchivedChatBar chatId={chat.id} conversationKind={chat.conversationKind} />
            </div>
        );
    }

    return (
        <div className="shrink-0 border-[var(--content-card-border)] border-t py-3">
            <ChatMessageComposer
                activeRunIds={activeRunIds}
                agents={agents}
                boundAgentIds={chat.boundAgentIds}
                canSend={chat.canSend}
                chatId={chat.id}
                conversationKind={chat.conversationKind}
                isDisabled={chat.isDisabled}
                isReplyActive={isReplyActive}
                placeholder="Message thread"
                stopChatId={stopChatId}
                threadTarget={{ anchorMessageId }}
            />
        </div>
    );
}

function ThreadLeadingContent({
    anchorRow,
    replyCount,
}: {
    anchorRow: TranscriptMessageRow;
    replyCount: number;
}) {
    return (
        <div>
            <ThreadAnchorMessage row={anchorRow} />
            {replyCount > 0 ? (
                <div className="my-3 flex items-center gap-3 px-4 text-center text-meta text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <div>
                        <div>Beginning of replies</div>
                        <div>{`${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`}</div>
                    </div>
                    <div className="h-px flex-1 bg-border" />
                </div>
            ) : (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No replies yet
                </div>
            )}
        </div>
    );
}

function findAnchorRow(rows: NonNullable<ChatLogOutput>['rows'], messageId: string) {
    return (
        rows.find(
            (row): row is Extract<typeof row, { kind: 'message' }> =>
                row.kind === 'message' && row.message.id === messageId
        ) ?? null
    );
}

function findAnchorEntryId(rows: NonNullable<ChatLogOutput>['rows'], messageId: string) {
    const entries = buildTranscriptEntries({ rows });
    return (
        entries.find(
            (entry) =>
                entry.kind === 'turn' &&
                entry.items.some((item: TranscriptItem) =>
                    item.kind === 'row' && item.row.kind === 'message'
                        ? item.row.message.id === messageId
                        : false
                )
        )?.id ?? null
    );
}

function scrollToAnchor(
    scroller: ReturnType<typeof useMessageScroller>,
    entryId: string,
    onScrolled: () => void
) {
    let frames = 0;
    const attempt = () => {
        if (scroller.scrollToMessage(entryId, { align: 'center', behavior: 'smooth' })) {
            onScrolled();
            return;
        }
        frames += 1;
        if (frames < 12) {
            window.requestAnimationFrame(attempt);
        }
    };
    window.requestAnimationFrame(attempt);
}
