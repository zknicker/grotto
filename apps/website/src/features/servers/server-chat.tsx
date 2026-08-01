import { Button, Chip, Tooltip } from '@heroui/react';
import { SidebarRightIcon, UserMultiple02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { setChatSidePane, useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import { useEnsureServerDm } from '../../hooks/servers/use-ensure-server-dm.ts';
import { useMarkServerChatReadOnView } from '../../hooks/servers/use-mark-server-chat-read.ts';
import { useServerChatMessages } from '../../hooks/servers/use-server-chat-messages.ts';
import { useViewportBelow } from '../../hooks/use-viewport-below.ts';
import { ChatArtifactPanel } from '../chats/chat-artifact-panel.tsx';
import { ChatDetailFrame } from '../chats/chat-detail-frame.tsx';
import { ChatViewSwitcher, type ChatViewTab } from '../chats/chat-view-tabs.tsx';
import type { TavernResourceTarget } from '../chats/tavern-resource-link.ts';
import { SectionBar, SectionHeader } from '../shell/section-header.tsx';
import { PageTopbar } from '../shell/shell-topbar.tsx';
import {
    HostedAgentCompositionBubbles,
    hasHostedAgentComposition,
} from './hosted-agent-composition-bubble.tsx';
import { HostedAgentProfilePanel } from './hosted-agent-profile-panel.tsx';
import { HostedChatFiles } from './hosted-chat-files.tsx';
import { useHostedServerContext } from './hosted-server-context.ts';
import { ServerChatComposer } from './server-chat-composer.tsx';
import { projectHostedChatMessages, ServerChatTranscript } from './server-chat-transcript.tsx';
import {
    ServerTasksBody,
    ServerTasksHeaderControls,
    ServerTasksProvider,
} from './tasks/server-tasks-surface.tsx';
import { ServerThreadPanel } from './thread/server-thread-panel.tsx';
import { useHostedChatArtifactPanel } from './use-hosted-chat-artifact-panel.ts';

export function ServerChat({
    agents,
    chat,
    initialTask,
    onOpenChat,
    role,
    server,
    viewerUserId,
}: {
    agents: HostedAgent[];
    chat: HostedChat;
    initialTask?: {
        message: HostedChatMessage;
        summary: HostedThreadSummary;
        threadChatId: string;
    };
    onOpenChat: (chatId: string) => void;
    role: 'admin' | 'member' | 'owner';
    server: import('../../lib/grotto-server.tsx').ServerDetail;
    viewerUserId: string;
}) {
    const [viewTab, setViewTab] = React.useState<ChatViewTab>('chat');
    const [searchParams, setSearchParams] = useSearchParams();
    const { agentLifecycles } = useHostedServerContext();
    const artifactState = useHostedChatArtifactPanel(chat.id);
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
    const messages = useServerChatMessages(chat.serverId, chat.id);
    const transcriptMessages = mergeTaskAnchor(messages.data?.messages, initialTask?.message);
    const transcriptRows = React.useMemo(
        () =>
            projectHostedChatMessages(
                transcriptMessages ?? [],
                messages.data?.threads ?? [],
                agents
            ),
        [agents, messages.data?.threads, transcriptMessages]
    );
    const lastSequence = messages.data?.messages.at(-1)?.sequence ?? 0;
    const read = useMarkServerChatReadOnView({
        chatId: messages.data ? chat.id : undefined,
        enabled: !(threadSelection && threadTakeover && activeSidePane === 'thread'),
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });
    const ensureDm = useEnsureServerDm(onOpenChat);
    const peerRetired = chat.kind === 'dm' && chat.peerAgentRetired;
    const chatName =
        chat.kind === 'channel'
            ? (chat.name ?? 'channel')
            : chat.peerAgentId
              ? (chat.peerAgentDisplayName ?? 'Agent')
              : `Direct · ${shortUserId(chat.peerUserId)}`;
    const threadSummary =
        messages.data?.threads.find(
            (summary) => summary.anchorMessageId === threadSelection?.anchor.id
        ) ??
        threadSelection?.initialSummary ??
        null;
    const initialThreadChatId = initialTask?.threadChatId;
    const threadAnchorId = searchParams.get('thread');
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
        setThreadSelection(null);
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
        <ServerThreadPanel
            active={activeSidePane === 'thread'}
            agentLifecycles={agentLifecycles}
            agents={agents}
            anchor={threadSelection.anchor}
            chat={chat}
            initialThreadChatId={threadSelection.initialThreadChatId}
            key={threadSelection.anchor.id}
            onClose={closeThread}
            onOpenArtifact={openArtifact}
            onViewInChannel={viewThreadInChannel}
            readOnly={peerRetired}
            summary={threadSummary}
            takeover={threadTakeover}
        />
    ) : null;

    return (
        <section
            aria-label={chatName}
            className="relative flex min-h-0 flex-1"
            data-slot="chat-surface"
        >
            <PageTopbar>
                <HostedChatTopbar
                    artifactVisible={artifactState.visible}
                    chat={chat}
                    chatName={chatName}
                    onToggleArtifacts={artifactState.toggleVisible}
                    onViewTabChange={setViewTab}
                    retired={peerRetired}
                    viewTab={viewTab}
                />
            </PageTopbar>
            <ChatDetailFrame
                activeReplies={[]}
                body={
                    viewTab === 'tasks' ? (
                        <ServerTasksProvider
                            chats={[chat]}
                            onOpenTask={() => setViewTab('chat')}
                            role={role}
                            serverId={chat.serverId}
                            viewerUserId={viewerUserId}
                        >
                            <section
                                aria-label="Chat tasks"
                                className="flex min-h-0 flex-1 flex-col"
                            >
                                <SectionBar>
                                    <SectionHeader title="Tasks">
                                        <ServerTasksHeaderControls />
                                    </SectionHeader>
                                </SectionBar>
                                <ServerTasksBody />
                            </section>
                        </ServerTasksProvider>
                    ) : viewTab === 'files' ? (
                        <HostedChatFiles messages={messages.data?.messages} />
                    ) : undefined
                }
                canRequestMention
                chatId={chat.id}
                emptyLabel="No messages yet."
                error={messages.error}
                footer={
                    viewTab === 'chat' ? (
                        <>
                            {ensureDm.error && !peerRetired ? (
                                <p className="px-9 text-destructive text-xs">
                                    {ensureDm.error.message}
                                </p>
                            ) : null}
                            <span className="sr-only" data-testid="read-state">
                                {read.data ? `Read through ${read.data.sequence}` : ''}
                            </span>
                            {peerRetired ? (
                                <p className="mx-auto w-full max-w-none px-9 pb-4 text-muted-foreground text-xs">
                                    {chatName} has been retired. You can read this conversation, but
                                    you can’t send new messages.
                                </p>
                            ) : (
                                <ServerChatComposer
                                    agents={agents}
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
                hasTransientTimelineContent={hasHostedAgentComposition(chat.id, agentLifecycles)}
                historyLoaded={Boolean(messages.data)}
                isPending={messages.isPending}
                rows={transcriptRows}
                sidePanel={
                    <>
                        <ChatArtifactPanel
                            agentId={chat.peerAgentId ?? ''}
                            open={artifactState.visible}
                            serverId={chat.serverId}
                            state={artifactState}
                        />
                        <HostedAgentProfilePanel agents={agents} chatId={chat.id} server={server} />
                        {threadTakeover ? null : (
                            <div className={activeSidePane === 'thread' ? 'contents' : 'hidden'}>
                                {threadPanel}
                            </div>
                        )}
                    </>
                }
                takeoverPanel={threadTakeover ? threadPanel : undefined}
                takeoverPanelActive={Boolean(
                    threadTakeover && threadPanel && activeSidePane === 'thread'
                )}
                timelineContent={(scrollContentRef) => (
                    <ServerChatTranscript
                        activeThreadAnchorId={
                            activeSidePane === 'thread' ? threadSelection?.anchor.id : undefined
                        }
                        agents={agents}
                        chatId={chat.id}
                        composition={
                            <HostedAgentCompositionBubbles
                                agents={agents}
                                chatId={chat.id}
                                lifecycles={agentLifecycles}
                            />
                        }
                        messages={transcriptMessages}
                        onOpenArtifact={openArtifact}
                        onOpenThread={openThread}
                        onStartDm={(peerUserId) =>
                            ensureDm.mutate({ peerUserId, serverId: chat.serverId })
                        }
                        scrollContentRef={scrollContentRef}
                        threads={messages.data?.threads}
                    />
                )}
                totalMessages={transcriptRows.length}
            />
        </section>
    );
}

function HostedChatTopbar({
    artifactVisible,
    chat,
    chatName,
    onToggleArtifacts,
    onViewTabChange,
    retired,
    viewTab,
}: {
    artifactVisible: boolean;
    chat: HostedChat;
    chatName: string;
    onToggleArtifacts: () => void;
    onViewTabChange: (tab: ChatViewTab) => void;
    retired: boolean;
    viewTab: ChatViewTab;
}) {
    return (
        <SectionHeader
            center={<ChatViewSwitcher onValueChange={onViewTabChange} value={viewTab} />}
            leading={chat.kind === 'channel' ? <ChannelIconBox size="topbar" /> : null}
            meta={retired ? <Chip size="sm">Retired</Chip> : null}
            title={chatName}
        >
            <span className="flex items-center gap-1 text-muted text-xs">
                <Icon aria-hidden="true" className="size-4" icon={UserMultiple02Icon} />
                {chat.participantUserIds.length}
            </span>
            <Tooltip>
                <Button
                    aria-label={artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                    isIconOnly
                    onPress={onToggleArtifacts}
                    size="sm"
                    variant={artifactVisible ? 'secondary' : 'ghost'}
                >
                    <Icon aria-hidden="true" icon={SidebarRightIcon} size={18} />
                </Button>
                <Tooltip.Content>
                    {artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                </Tooltip.Content>
            </Tooltip>
        </SectionHeader>
    );
}

export function mergeTaskAnchor(
    messages: HostedChatMessage[] | undefined,
    anchor: HostedChatMessage | undefined
) {
    if (!(messages && anchor) || messages.some((message) => message.id === anchor.id)) {
        return messages;
    }
    return [...messages, anchor].sort((left, right) => left.sequence - right.sequence);
}

function shortUserId(userId: string | null) {
    return userId ? `Human ${userId.slice(-6)}` : 'Human';
}
