import type { HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { setChatSidePane, useChatSidePane } from '../../../hooks/pane/use-chat-side-pane.ts';
import { useChatMessages } from '../../../hooks/servers/use-chat-messages.ts';
import { useChatRead } from '../../../hooks/servers/use-chat-read.ts';
import { useDmEnsure } from '../../../hooks/servers/use-dm-ensure.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useWindowTitle } from '../../../hooks/shell/use-window-title.ts';
import { useViewportBelow } from '../../../hooks/use-viewport-below.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { ChatArtifactPanel } from '../../chats/chat-artifact-panel.tsx';
import { ChatDetailFrame } from '../../chats/chat-detail-frame.tsx';
import type { ChatViewTab } from '../../chats/chat-view-tabs.tsx';
import { SectionBar, SectionHeader } from '../../shell/section-header.tsx';
import { ShellSidePane } from '../../shell/shell-side-pane.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';
import { useAgentLifecycle } from '../agent-lifecycle.tsx';
import { AgentProfilePanel } from '../agent-profile-panel.tsx';
import { TaskContent } from '../tasks/task-content.tsx';
import { TaskControls } from '../tasks/task-controls.tsx';
import { ThreadPanel } from '../thread/thread-panel.tsx';
import { ChatAgentComposition, hasAgentComposition } from './agent-composition.tsx';
import { ArchivedChannelBar } from './archived-channel-bar.tsx';
import { ChatComposer } from './chat-composer.tsx';
import { ChatFiles } from './chat-files.tsx';
import { mergeTaskAnchor } from './chat-message-model.ts';
import { ChatTopbar } from './chat-topbar.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import { PendingChatMessages } from './pending-messages.tsx';
import { useChatArtifactPanel } from './use-artifact-panel.ts';
import { usePendingChatMessages } from './use-pending-messages.ts';

export function ChatView({
    chat,
    initialTask,
    onOpenChat,
    server,
}: {
    chat: HostedChat;
    initialTask?: {
        message: HostedChatMessage;
        summary: HostedThreadSummary;
        threadChatId: string;
    };
    onOpenChat: (chatId: string) => void;
    server: ServerDetail;
}) {
    const [viewTab, setViewTab] = React.useState<ChatViewTab>('chat');
    const [searchParams, setSearchParams] = useSearchParams();
    const agentLifecycles = useAgentLifecycle();
    const artifactState = useChatArtifactPanel(chat.id);
    const activeSidePane = useChatSidePane(chat.id);
    const [threadSelection, setThreadSelection] = React.useState<{
        anchor: HostedChatMessage;
        initialSummary: HostedThreadSummary | null;
        initialThreadChatId?: string;
    } | null>(() =>
        initialTask
            ? {
                  anchor: initialTask.message,
                  initialSummary: initialTask.summary,
                  initialThreadChatId: initialTask.threadChatId,
              }
            : null
    );
    const threadTakeover = useViewportBelow(1024);
    const messages = useChatMessages(chat.serverId, chat.id);
    const pendingMessages = usePendingChatMessages(chat.id, messages.data?.messages);
    const sourceMessages = messages.data?.messages;
    const anchorMessage = initialTask?.message;
    // Memoized so the transcript keeps projecting against one array identity:
    // React Query's structural sharing only pays off downstream if the merge
    // above it does not hand out a fresh array on every render.
    const transcriptMessages = React.useMemo(
        () => mergeTaskAnchor(sourceMessages, anchorMessage),
        [anchorMessage, sourceMessages]
    );
    const lastSequence = messages.data?.messages.at(-1)?.sequence ?? 0;
    const read = useChatRead({
        chatId: messages.data ? chat.id : undefined,
        enabled: !(threadSelection && threadTakeover && activeSidePane === 'thread'),
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });
    const ensureDm = useDmEnsure(onOpenChat);
    const humans = useHumanDirectory(chat.serverId);
    const peerRetired = chat.kind === 'dm' && chat.peerAgentRetired;
    const readOnly = peerRetired || chat.archivedAt !== null;
    const chatName =
        chat.kind === 'channel'
            ? (chat.name ?? 'channel')
            : chat.peerAgentId
              ? (chat.peerAgentDisplayName ?? 'Agent')
              : `Direct · ${humans.name(chat.peerUserId)}`;
    useWindowTitle(chat.kind === 'channel' ? `#${chatName}` : chatName);
    const threadSummary =
        messages.data?.threads.find(
            (summary) => summary.anchorMessageId === threadSelection?.anchor.id
        ) ??
        threadSelection?.initialSummary ??
        null;
    const initialThreadChatId = initialTask?.threadChatId;
    const threadAnchorId = searchParams.get('thread');
    const threadCloseRequestedRef = React.useRef(false);
    const restoredThreadAnchorRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (initialThreadChatId) {
            setChatSidePane(chat.id, 'thread');
        }
    }, [chat.id, initialThreadChatId]);
    React.useEffect(() => {
        if (!threadAnchorId) {
            restoredThreadAnchorRef.current = null;
            return;
        }
        if (!transcriptMessages || restoredThreadAnchorRef.current === threadAnchorId) {
            return;
        }
        const anchor = transcriptMessages.find((message) => message.id === threadAnchorId);
        if (!anchor) {
            return;
        }
        restoredThreadAnchorRef.current = threadAnchorId;
        if (threadSelection?.anchor.id === anchor.id) {
            return;
        }
        setThreadSelection({ anchor, initialSummary: null });
        setChatSidePane(chat.id, 'thread');
    }, [chat.id, threadAnchorId, threadSelection?.anchor.id, transcriptMessages]);

    const closeThread = React.useCallback(() => {
        threadCloseRequestedRef.current = true;
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('thread');
                return next;
            },
            { replace: true }
        );
        setChatSidePane(chat.id, 'artifact');
    }, [chat.id, setSearchParams]);
    // The transcript's render context reaches every row through React context,
    // so these handlers stay referentially stable: a fresh callback per render
    // would rebuild that context and re-render the whole transcript.
    const openThread = React.useCallback(
        (anchor: HostedChatMessage, initialSummary: HostedThreadSummary | null) => {
            threadCloseRequestedRef.current = false;
            setThreadSelection({ anchor, initialSummary });
            setSearchParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    next.set('thread', anchor.id);
                    return next;
                },
                { replace: true }
            );
            setChatSidePane(chat.id, 'thread');
        },
        [chat.id, setSearchParams]
    );
    const viewThreadInChannel = () => {
        const anchorId = threadSelection?.anchor.id;
        closeThread();
        if (!anchorId) {
            return;
        }
        window.requestAnimationFrame(() => {
            const element = document.querySelector(`[data-message-id="${CSS.escape(anchorId)}"]`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element?.classList.add('chat-thread-flash');
            window.setTimeout(() => element?.classList.remove('chat-thread-flash'), 1500);
        });
    };
    // The chat-scoped pane and Thread share the side panel. The latest
    // artifact opener wins and reveals the pane.
    const openArtifact = artifactState.open;
    const startDm = React.useCallback(
        (peerUserId: string) => ensureDm.mutate({ peerUserId, serverId: chat.serverId }),
        [chat.serverId, ensureDm.mutate]
    );
    const threadPanel = threadSelection ? (
        <ThreadPanel
            active={activeSidePane === 'thread'}
            anchor={threadSelection.anchor}
            chat={chat}
            initialThreadChatId={threadSelection.initialThreadChatId}
            onClose={closeThread}
            onExitComplete={() => {
                if (threadCloseRequestedRef.current) {
                    threadCloseRequestedRef.current = false;
                    setThreadSelection(null);
                }
            }}
            onOpenArtifact={openArtifact}
            onViewInChannel={viewThreadInChannel}
            readOnly={readOnly}
            summary={threadSummary}
            takeover={threadTakeover}
            turnDetailsAccess={server.role === 'member' ? 'summary' : 'journal'}
        />
    ) : null;
    const sidePanel = (
        <>
            <ChatArtifactPanel
                agentId={chat.peerAgentId ?? ''}
                open={artifactState.visible}
                serverId={chat.serverId}
                state={artifactState}
                takeover={threadTakeover}
            />
            <AgentProfilePanel chatId={chat.id} server={server} takeover={threadTakeover} />
            {threadPanel}
        </>
    );
    const sidePanelTakeover = Boolean(
        threadTakeover &&
            ((activeSidePane === 'artifact' && artifactState.visible) ||
                activeSidePane === 'profile' ||
                (activeSidePane === 'thread' && threadPanel))
    );

    return (
        <section
            aria-label={chatName}
            className="relative flex min-h-0 flex-1"
            data-slot="chat-surface"
        >
            <PageTopbar>
                <ChatTopbar
                    artifactVisible={artifactState.visible}
                    chat={chat}
                    chatName={chatName}
                    onToggleArtifacts={artifactState.toggleVisible}
                    onViewTabChange={setViewTab}
                    server={server}
                    viewTab={viewTab}
                />
            </PageTopbar>
            <ShellSidePane takeover={sidePanelTakeover}>{sidePanel}</ShellSidePane>
            <ChatDetailFrame
                activeReplies={[]}
                body={
                    viewTab === 'tasks' ? (
                        <section aria-label="Chat tasks" className="flex min-h-0 flex-1 flex-col">
                            <SectionBar>
                                <SectionHeader title="Tasks">
                                    <TaskControls chatId={chat.id} />
                                </SectionHeader>
                            </SectionBar>
                            <TaskContent chatId={chat.id} onOpenTask={() => setViewTab('chat')} />
                        </section>
                    ) : viewTab === 'files' ? (
                        <ChatFiles messages={messages.data?.messages} />
                    ) : undefined
                }
                chatId={chat.id}
                emptyLabel="No messages yet."
                error={messages.error}
                footer={
                    viewTab === 'chat' ? (
                        <>
                            {ensureDm.error && !peerRetired ? (
                                <p className="px-9 text-danger text-sm">{ensureDm.error.message}</p>
                            ) : null}
                            <span className="sr-only" data-testid="read-state">
                                {read.data ? `Read through ${read.data.sequence}` : ''}
                            </span>
                            {chat.archivedAt ? (
                                <ArchivedChannelBar
                                    canManage={server.role === 'owner' || server.role === 'admin'}
                                    chat={chat}
                                />
                            ) : peerRetired ? (
                                <p className="mx-auto w-full max-w-none px-9 pb-4 text-muted text-sm">
                                    {chatName} has been retired. You can read this conversation, but
                                    you can’t send new messages.
                                </p>
                            ) : (
                                <ChatComposer
                                    chatId={chat.id}
                                    chatName={chatName}
                                    pendingChatId={chat.id}
                                    placeholder="Let's go on an adventure..."
                                    serverId={chat.serverId}
                                />
                            )}
                        </>
                    ) : null
                }
                hasTransientTimelineContent={
                    hasAgentComposition(chat.id, agentLifecycles) || pendingMessages.length > 0
                }
                historyLoaded={Boolean(messages.data)}
                isPending={messages.isPending}
                rowCount={transcriptMessages?.length ?? 0}
                timelineContent={(scrollContentRef) => (
                    <ChatTranscript
                        chatId={chat.id}
                        composition={
                            <>
                                <PendingChatMessages
                                    messages={pendingMessages}
                                    serverId={chat.serverId}
                                    viewerUserId={server.viewerUserId}
                                />
                                <ChatAgentComposition chatId={chat.id} serverId={chat.serverId} />
                            </>
                        }
                        messages={transcriptMessages}
                        onOpenArtifact={openArtifact}
                        onOpenThread={openThread}
                        onStartDm={startDm}
                        scrollContentRef={scrollContentRef}
                        serverId={chat.serverId}
                        threads={messages.data?.threads}
                        turnDetailsAccess={server.role === 'member' ? 'summary' : 'journal'}
                    />
                )}
            />
        </section>
    );
}
