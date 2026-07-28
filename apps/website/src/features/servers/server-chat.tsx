import {
    Attachment01Icon,
    SidebarRightIcon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { ChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { setChatSidePane, useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import { useEnsureServerDm } from '../../hooks/servers/use-ensure-server-dm.ts';
import { useMarkServerChatReadOnView } from '../../hooks/servers/use-mark-server-chat-read.ts';
import { useServerChatMessages } from '../../hooks/servers/use-server-chat-messages.ts';
import { useViewportBelow } from '../../hooks/use-viewport-below.ts';
import { ArtifactPanelOpenProvider } from '../chats/artifact-panel-context.tsx';
import { ChatArtifactPanel } from '../chats/chat-artifact-panel.tsx';
import { ChatDetailFrame } from '../chats/chat-detail-frame.tsx';
import { ChatRoomTopbarPresentation } from '../chats/chat-room-topbar.tsx';
import { type ChatViewTab, ChatViewTabs } from '../chats/chat-view-tabs.tsx';
import { ToolbarDivider } from '../shell/toolbar-divider.tsx';
import { HostedAgentProfilePanel } from './hosted-agent-profile-panel.tsx';
import { ServerChatComposer } from './server-chat-composer.tsx';
import { projectHostedChatMessages, ServerChatTranscript } from './server-chat-transcript.tsx';
import { ServerTasksSurface } from './tasks/server-tasks-surface.tsx';
import { ServerThreadPanel } from './thread/server-thread-panel.tsx';

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
    const [artifactVisible, setArtifactVisible] = React.useState(false);
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
        () => projectHostedChatMessages(transcriptMessages ?? [], messages.data?.threads ?? []),
        [messages.data?.threads, transcriptMessages]
    );
    const lastSequence = messages.data?.messages.at(-1)?.sequence ?? 0;
    const read = useMarkServerChatReadOnView({
        chatId: messages.data ? chat.id : undefined,
        enabled: !(threadSelection && threadTakeover),
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });
    const ensureDm = useEnsureServerDm(onOpenChat);
    const toggleArtifacts = () => {
        if (!artifactVisible) {
            setChatSidePane(chat.id, 'artifact');
        }
        setArtifactVisible((visible) => !visible);
    };

    const chatName =
        chat.kind === 'channel'
            ? (chat.name ?? 'channel')
            : `Direct · ${shortUserId(chat.peerUserId)}`;
    const threadSummary =
        messages.data?.threads.find(
            (summary) => summary.anchorMessageId === threadSelection?.anchor.id
        ) ??
        threadSelection?.initialSummary ??
        null;
    const closeThread = () => setThreadSelection(null);
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
    const threadPanel = threadSelection ? (
        <ServerThreadPanel
            agents={agents}
            anchor={threadSelection.anchor}
            chat={chat}
            initialThreadChatId={threadSelection.initialThreadChatId}
            key={threadSelection.anchor.id}
            onClose={closeThread}
            onViewInChannel={viewThreadInChannel}
            summary={threadSummary}
            takeover={threadTakeover}
        />
    ) : null;

    const artifactState: ChatArtifactPanelState = {
        activeKey: null,
        closeActiveTarget: () => undefined,
        closeTarget: () => undefined,
        open: () => {
            setChatSidePane(chat.id, 'artifact');
            setArtifactVisible(true);
        },
        setActiveKey: () => undefined,
        targets: [],
        toggleVisible: () => {
            setChatSidePane(chat.id, 'artifact');
            setArtifactVisible((visible) => !visible);
        },
        visible: artifactVisible && activeSidePane === 'artifact',
    };
    const hostedAgentId = chat.peerAgentId ?? agents[0]?.id ?? '';

    return (
        <ArtifactPanelOpenProvider onOpen={artifactState.open}>
            <section aria-label={chatName} className="flex min-h-0 flex-1">
                <ChatDetailFrame
                    activeReplies={[]}
                    body={
                        viewTab === 'tasks' ? (
                            <ServerTasksSurface
                                chats={[chat]}
                                onOpenTask={() => setViewTab('chat')}
                                role={role}
                                serverId={chat.serverId}
                                viewerUserId={viewerUserId}
                            />
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
                                {ensureDm.error ? (
                                    <p className="px-9 text-destructive text-xs">
                                        {ensureDm.error.message}
                                    </p>
                                ) : null}
                                <span className="sr-only" data-testid="read-state">
                                    {read.data ? `Read through ${read.data.sequence}` : ''}
                                </span>
                                <ServerChatComposer
                                    agents={agents}
                                    chatId={chat.id}
                                    chatName={chatName}
                                    compositionChatId={chat.id}
                                    placeholder="Let's go on an adventure..."
                                    serverId={chat.serverId}
                                />
                            </>
                        ) : null
                    }
                    header={
                        <>
                            <HostedChatTopbar
                                artifactVisible={artifactVisible && !threadSelection}
                                chat={chat}
                                chatName={chatName}
                                onToggleArtifacts={toggleArtifacts}
                            />
                            <ChatViewTabs onValueChange={setViewTab} value={viewTab} />
                        </>
                    }
                    historyLoaded={Boolean(messages.data)}
                    isPending={messages.isPending}
                    rows={transcriptRows}
                    sidePanel={
                        <>
                            <ChatArtifactPanel
                                agentId={hostedAgentId}
                                open={
                                    artifactVisible &&
                                    activeSidePane === 'artifact' &&
                                    !threadSelection
                                }
                                state={artifactState}
                            />
                            <HostedAgentProfilePanel
                                agents={agents}
                                chatId={chat.id}
                                server={server}
                            />
                            {threadTakeover ? null : threadPanel}
                        </>
                    }
                    takeoverPanel={threadPanel && threadTakeover ? threadPanel : undefined}
                    timelineContent={(scrollContentRef) => (
                        <ServerChatTranscript
                            activeThreadAnchorId={threadSelection?.anchor.id}
                            agents={agents}
                            chatId={chat.id}
                            messages={transcriptMessages}
                            onOpenThread={(anchor, summary) =>
                                setThreadSelection({ anchor, initialSummary: summary })
                            }
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
        </ArtifactPanelOpenProvider>
    );
}

function HostedChatTopbar({
    artifactVisible,
    chat,
    chatName,
    onToggleArtifacts,
}: {
    artifactVisible: boolean;
    chat: HostedChat;
    chatName: string;
    onToggleArtifacts: () => void;
}) {
    return (
        <ChatRoomTopbarPresentation
            actions={
                <>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Icon className="size-4" icon={UserMultiple02Icon} />
                        {chat.participantUserIds.length}
                    </span>
                    <ToolbarDivider />
                    <Button
                        aria-label={artifactVisible ? 'Hide artifacts' : 'Show artifacts'}
                        className={
                            artifactVisible
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }
                        onClick={onToggleArtifacts}
                        size="icon-sm"
                        variant={artifactVisible ? 'secondary' : 'ghost'}
                    >
                        <Icon className="size-[18px]" icon={SidebarRightIcon} strokeWidth={1.8} />
                    </Button>
                </>
            }
            identity={
                <>
                    {chat.kind === 'channel' ? <ChannelIconBox size="topbar" /> : null}
                    <h1 className="min-w-0 truncate font-semibold text-foreground text-sm">
                        {chatName}
                    </h1>
                </>
            }
        />
    );
}

function HostedChatFiles({ messages }: { messages: HostedChatMessage[] | undefined }) {
    const attachments = messages?.flatMap((message) => message.attachments) ?? [];
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
            {attachments.length === 0 ? (
                <p className="m-auto text-muted-foreground text-sm">No files in this chat.</p>
            ) : (
                attachments.map((attachment) => (
                    <div
                        className="flex items-center gap-3 border-border border-b py-3"
                        key={attachment.id}
                    >
                        <Icon className="size-4 text-muted-foreground" icon={Attachment01Icon} />
                        <span className="text-sm">{attachment.filename}</span>
                    </div>
                ))
            )}
        </div>
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
