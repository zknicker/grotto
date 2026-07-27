import type { HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { useEnsureServerDm } from '../../hooks/servers/use-ensure-server-dm.ts';
import { useMarkServerChatReadOnView } from '../../hooks/servers/use-mark-server-chat-read.ts';
import { useServerChatMessages } from '../../hooks/servers/use-server-chat-messages.ts';
import { useViewportBelow } from '../../hooks/use-viewport-below.ts';
import { ServerChatComposer } from './server-chat-composer.tsx';
import { ServerChatTranscript } from './server-chat-transcript.tsx';
import { ServerThreadPanel } from './thread/server-thread-panel.tsx';

export function ServerChat({
    chat,
    initialTask,
    onOpenChat,
}: {
    chat: HostedChat;
    initialTask?: {
        message: HostedChatMessage;
        summary: HostedThreadSummary;
        threadChatId: string;
    };
    onOpenChat: (chatId: string) => void;
}) {
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
    const lastSequence = messages.data?.messages.at(-1)?.sequence ?? 0;
    const read = useMarkServerChatReadOnView({
        chatId: messages.data ? chat.id : undefined,
        enabled: !(threadSelection && threadTakeover),
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });
    const ensureDm = useEnsureServerDm(onOpenChat);

    const chatName =
        chat.kind === 'channel' ? `#${chat.name}` : `Direct · ${shortUserId(chat.peerUserId)}`;
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
            const element = document.getElementById(`hosted-message-${anchorId}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element?.classList.add('chat-thread-flash');
            window.setTimeout(() => element?.classList.remove('chat-thread-flash'), 1500);
        });
    };
    const threadPanel = threadSelection ? (
        <ServerThreadPanel
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

    if (threadPanel && threadTakeover) {
        return (
            <section aria-label={chatName} className="flex min-h-0 flex-1">
                {threadPanel}
            </section>
        );
    }

    return (
        <section aria-label={chatName} className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="border-border border-b px-6 py-3 text-foreground text-sm">
                    {chatName}
                </h2>
                <div className="min-h-0 flex-1">
                    <ServerChatTranscript
                        activeThreadAnchorId={threadSelection?.anchor.id}
                        messages={transcriptMessages}
                        onOpenThread={(anchor, summary) =>
                            setThreadSelection({ anchor, initialSummary: summary })
                        }
                        onStartDm={(peerUserId) =>
                            ensureDm.mutate({ peerUserId, serverId: chat.serverId })
                        }
                        threads={messages.data?.threads}
                    />
                </div>
                {ensureDm.error ? (
                    <p className="px-9 text-destructive text-xs">{ensureDm.error.message}</p>
                ) : null}
                <p
                    className="mx-auto w-full max-w-[60rem] px-9 text-muted-foreground text-xs"
                    data-testid="read-state"
                >
                    {read.data ? `Read through ${read.data.sequence}` : ''}
                </p>
                <ServerChatComposer
                    chatId={chat.id}
                    chatName={chatName}
                    compositionChatId={chat.id}
                    serverId={chat.serverId}
                />
            </div>
            {threadPanel}
        </section>
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
