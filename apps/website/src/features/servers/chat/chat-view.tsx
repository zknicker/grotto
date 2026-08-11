import type { HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { setChatSidePane, useChatSidePane } from '../../../hooks/pane/use-chat-side-pane.ts';
import { useChatMessages } from '../../../hooks/servers/use-chat-messages.ts';
import { useChatRead } from '../../../hooks/servers/use-chat-read.ts';
import { useDmEnsure } from '../../../hooks/servers/use-dm-ensure.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useViewportBelow } from '../../../hooks/use-viewport-below.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { ChatArtifactPanel } from '../../chats/chat-artifact-panel.tsx';
import { ChatDetailFrame } from '../../chats/chat-detail-frame.tsx';
import type { ChatViewTab } from '../../chats/chat-view-tabs.tsx';
import type { TavernResourceTarget } from '../../chats/tavern-resource-link.ts';
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
import { mergeTaskAnchor, projectChatMessages } from './chat-message-model.ts';
import { ChatTopbar } from './chat-topbar.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import { useChatArtifactPanel } from './use-artifact-panel.ts';

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
    const transcriptMessages = mergeTaskAnchor(messages.data?.messages, initialTask?.message);
    const transcriptRows = React.useMemo(
        () => projectChatMessages(transcriptMessages ?? [], messages.data?.threads ?? []),
        [messages.data?.threads, transcriptMessages]
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

    const closeThread = () => {
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
    };
    const openThread = (anchor: HostedChatMessage, initialSummary: HostedThreadSummary | null) => {
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
    };
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
    const openArtifact = (target: TavernResourceTarget) => {
        // The chat-scoped pane and Thread share the side panel. The latest
        // artifact opener wins and reveals the pane.
        artifactState.open(target);
    };
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
                canRequestMention={!readOnly}
                chatId={chat.id}
                emptyLabel="No messages yet."
                error={messages.error}
                footer={
                    viewTab === 'chat' ? (
                        <>
                            {ensureDm.error && !peerRetired ? (
                                <p className="px-9 text-danger text-xs">{ensureDm.error.message}</p>
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
                                <p className="mx-auto w-full max-w-none px-9 pb-4 text-muted text-xs">
                                    {chatName} has been retired. You can read this conversation, but
                                    you can’t send new messages.
                                </p>
                            ) : (
                                <ChatComposer
                                    chatId={chat.id}
                                    chatName={chatName}
                                    compositionChatId={chat.id}
                                    placeholder="Let's go on an adventure..."
                                    serverId={chat.serverId}
                                />
                            )}
                        </>
                    ) : null
                }
                hasTransientTimelineContent={hasAgentComposition(chat.id, agentLifecycles)}
                historyLoaded={Boolean(messages.data)}
                isPending={messages.isPending}
                rows={transcriptRows}
                timelineContent={(scrollContentRef) => (
                    <ChatTranscript
                        chatId={chat.id}
                        composition={
                            <ChatAgentComposition chatId={chat.id} serverId={chat.serverId} />
                        }
                        messages={transcriptMessages}
                        onOpenArtifact={openArtifact}
                        onOpenThread={openThread}
                        onStartDm={(peerUserId) =>
                            ensureDm.mutate({ peerUserId, serverId: chat.serverId })
                        }
                        scrollContentRef={scrollContentRef}
                        serverId={chat.serverId}
                        threads={messages.data?.threads}
                    />
                )}
                totalMessages={transcriptMessages?.length ?? 0}
            />
        </section>
    );
}
