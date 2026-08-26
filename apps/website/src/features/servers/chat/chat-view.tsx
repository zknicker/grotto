import type { Chat, ChatMessage, ThreadSummary } from '@grotto/api';
import { EmptyState } from '@heroui-pro/react';
import { Message01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
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
import { ShellSidePane } from '../../shell/shell-side-pane.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';
import { useAgentLifecycle } from '../agent-lifecycle.tsx';
import { AgentProfilePanel } from '../agent-profile-panel.tsx';
import { ThreadPanel } from '../thread/thread-panel.tsx';
import { ChatAgentComposition, hasAgentComposition } from './agent-composition.tsx';
import { ArchivedChannelBar } from './archived-channel-bar.tsx';
import { ChatComposer } from './chat-composer-variants.tsx';
import { ChatFilesPanel } from './chat-files.tsx';
import { mergeTaskAnchor } from './chat-message-model.ts';
import { ChatTopbar } from './chat-topbar.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import { useChatArtifactPanel } from './use-artifact-panel.ts';
import { useChatFilesPane } from './use-chat-files-pane.ts';
import { usePendingChatMessages } from './use-pending-messages.ts';

export function ChatView({
    chat,
    initialTask,
    onOpenChat,
    server,
}: {
    chat: Chat;
    initialTask?: {
        message: ChatMessage;
        summary: ThreadSummary;
        threadChatId: string;
    };
    onOpenChat: (chatId: string) => void;
    server: ServerDetail;
}) {
    const filesPane = useChatFilesPane(chat.id);
    const [searchParams, setSearchParams] = useSearchParams();
    const agentLifecycles = useAgentLifecycle();
    const artifactState = useChatArtifactPanel(chat.id);
    const activeSidePane = useChatSidePane(chat.id);
    const [threadSelection, setThreadSelection] = React.useState<{
        anchor: ChatMessage;
        initialSummary: ThreadSummary | null;
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
              : `DM · ${humans.name(chat.peerUserId)}`;
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
        (anchor: ChatMessage, initialSummary: ThreadSummary | null) => {
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
            canManage={server.role === 'owner' || server.role === 'admin'}
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
            <ChatFilesPanel
                messages={messages.data?.messages}
                onClose={filesPane.close}
                open={filesPane.visible}
                takeover={threadTakeover}
            />
            {threadPanel}
        </>
    );
    const sidePanelTakeover = Boolean(
        threadTakeover &&
            ((activeSidePane === 'artifact' && artifactState.visible) ||
                (activeSidePane === 'files' && filesPane.visible) ||
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
                    onOpenFiles={filesPane.open}
                    onToggleArtifacts={artifactState.toggleVisible}
                    server={server}
                />
            </PageTopbar>
            <ShellSidePane takeover={sidePanelTakeover}>{sidePanel}</ShellSidePane>
            <ChatDetailFrame
                activeReplies={[]}
                chatId={chat.id}
                empty={
                    <EmptyState>
                        <EmptyState.Header>
                            <EmptyState.Media variant="icon">
                                <Icon aria-hidden="true" icon={Message01Icon} />
                            </EmptyState.Media>
                            <EmptyState.Title>No messages yet</EmptyState.Title>
                            <EmptyState.Description>
                                {chat.kind === 'channel'
                                    ? `Start the conversation in #${chatName}.`
                                    : `Send the first message to ${chatName}.`}
                            </EmptyState.Description>
                        </EmptyState.Header>
                    </EmptyState>
                }
                error={messages.error}
                footer={
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
                                {chatName} has been retired. You can read this conversation, but you
                                can’t send new messages.
                            </p>
                        ) : (
                            <ChatComposer
                                chatId={chat.id}
                                chatName={chatName}
                                pendingChatId={chat.id}
                                serverId={chat.serverId}
                            />
                        )}
                    </>
                }
                hasTransientTimelineContent={
                    hasAgentComposition(chat.id, agentLifecycles) || pendingMessages.length > 0
                }
                historyLoaded={Boolean(messages.data)}
                isPending={messages.isPending}
                rowCount={transcriptMessages?.length ?? 0}
                timelineContent={(scrollContentRef) => (
                    <ChatTranscript
                        canManage={server.role === 'owner' || server.role === 'admin'}
                        chatId={chat.id}
                        composition={
                            <ChatAgentComposition chatId={chat.id} serverId={chat.serverId} />
                        }
                        messages={transcriptMessages}
                        onOpenArtifact={openArtifact}
                        onOpenThread={openThread}
                        onStartDm={startDm}
                        pendingMessages={pendingMessages}
                        scrollContentRef={scrollContentRef}
                        serverId={chat.serverId}
                        threads={messages.data?.threads}
                        turnDetailsAccess={server.role === 'member' ? 'summary' : 'journal'}
                        viewerUserId={server.viewerUserId}
                    />
                )}
            />
        </section>
    );
}
