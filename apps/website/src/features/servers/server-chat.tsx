import { SidebarRightIcon, UserMultiple02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent, HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { useEnsureServerDm } from '../../hooks/servers/use-ensure-server-dm.ts';
import { useMarkServerChatReadOnView } from '../../hooks/servers/use-mark-server-chat-read.ts';
import { useServerChatMessages } from '../../hooks/servers/use-server-chat-messages.ts';
import { useViewportBelow } from '../../hooks/use-viewport-below.ts';
import { ChatArtifactPanel } from '../chats/chat-artifact-panel.tsx';
import { ChatDetailFrame } from '../chats/chat-detail-frame.tsx';
import { ChatRoomTopbarPresentation } from '../chats/chat-room-topbar.tsx';
import { type ChatViewTab, ChatViewTabs } from '../chats/chat-view-tabs.tsx';
import { ToolbarDivider } from '../shell/toolbar-divider.tsx';
import {
    HostedAgentCompositionBubbles,
    hasHostedAgentComposition,
} from './hosted-agent-composition-bubble.tsx';
import { HostedAgentProfilePanel } from './hosted-agent-profile-panel.tsx';
import { HostedChatFiles } from './hosted-chat-files.tsx';
import { useHostedServerContext } from './hosted-server-context.ts';
import { ServerChatComposer } from './server-chat-composer.tsx';
import { projectHostedChatMessages, ServerChatTranscript } from './server-chat-transcript.tsx';
import { ServerTasksSurface } from './tasks/server-tasks-surface.tsx';
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
    const { agentLifecycles } = useHostedServerContext();
    const artifactState = useHostedChatArtifactPanel(chat.id);
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
        enabled: !(threadSelection && threadTakeover),
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
            agentLifecycles={agentLifecycles}
            agents={agents}
            anchor={threadSelection.anchor}
            chat={chat}
            initialThreadChatId={threadSelection.initialThreadChatId}
            key={threadSelection.anchor.id}
            onClose={closeThread}
            onViewInChannel={viewThreadInChannel}
            readOnly={peerRetired}
            summary={threadSummary}
            takeover={threadTakeover}
        />
    ) : null;

    return (
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
                header={
                    <>
                        <HostedChatTopbar
                            artifactVisible={artifactState.visible && !threadSelection}
                            chat={chat}
                            chatName={chatName}
                            onToggleArtifacts={artifactState.toggleVisible}
                            retired={peerRetired}
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
                            agentId={chat.peerAgentId ?? ''}
                            open={artifactState.visible && !threadSelection}
                            serverId={chat.serverId}
                            state={artifactState}
                        />
                        <HostedAgentProfilePanel agents={agents} chatId={chat.id} server={server} />
                        {threadTakeover ? null : threadPanel}
                    </>
                }
                takeoverPanel={threadPanel && threadTakeover ? threadPanel : undefined}
                timelineContent={(scrollContentRef) => (
                    <ServerChatTranscript
                        activeThreadAnchorId={threadSelection?.anchor.id}
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
                        onOpenArtifact={artifactState.open}
                        onOpenThread={(anchor, summary) =>
                            setThreadSelection({
                                anchor,
                                initialSummary: summary,
                                initialThreadChatId: anchor.task?.threadChatId,
                            })
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
    );
}

function HostedChatTopbar({
    artifactVisible,
    chat,
    chatName,
    onToggleArtifacts,
    retired,
}: {
    artifactVisible: boolean;
    chat: HostedChat;
    chatName: string;
    onToggleArtifacts: () => void;
    retired: boolean;
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
                    {retired ? <Badge variant="secondary">Retired</Badge> : null}
                </>
            }
        />
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
