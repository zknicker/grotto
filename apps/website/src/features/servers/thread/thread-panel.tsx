import { Button } from '@heroui/react';
import type { HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { useChatRead } from '../../../hooks/servers/use-chat-read.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useMembers } from '../../../hooks/servers/use-members.ts';
import { useThreadFollow } from '../../../hooks/servers/use-thread-follow.ts';
import { useThreadMessages } from '../../../hooks/servers/use-thread-messages.ts';
import { ChatSidePaneShell } from '../../chats/chat-side-pane-shell.tsx';
import { buildTranscriptEntries } from '../../chats/chat-transcript-model.ts';
import { TranscriptRenderProvider } from '../../chats/chat-transcript-render-context.tsx';
import { TranscriptEntryView } from '../../chats/chat-transcript-turn.tsx';
import type { TavernResourceTarget } from '../../chats/tavern-resource-link.ts';
import { ThreadPanelHeader } from '../../chats/thread/thread-panel-header.tsx';
import { ChatAgentComposition } from '../chat/agent-composition.tsx';
import { ChatComposer } from '../chat/chat-composer.tsx';
import { useChatTranscript } from '../chat/chat-transcript.tsx';
import { PendingChatMessages } from '../chat/pending-messages.tsx';
import { pendingThreadReplyKey, usePendingChatMessages } from '../chat/use-pending-messages.ts';
import { threadTitles } from './thread-target.ts';

export function ThreadPanel({
    active,
    anchor,
    chat,
    initialThreadChatId,
    onClose,
    onExitComplete,
    onOpenArtifact,
    onViewInChannel,
    readOnly,
    summary,
    takeover,
}: {
    active: boolean;
    anchor: HostedChatMessage;
    chat: HostedChat;
    initialThreadChatId?: string;
    onClose: () => void;
    onExitComplete: () => void;
    onOpenArtifact: (target: TavernResourceTarget) => void;
    onViewInChannel: () => void;
    readOnly: boolean;
    summary: HostedThreadSummary | null;
    takeover: boolean;
}) {
    return (
        <ChatSidePaneShell
            keepMounted
            label="Thread"
            onExitComplete={onExitComplete}
            open={active}
            takeover={takeover}
        >
            {(width) => (
                <ThreadContent
                    active={active}
                    anchor={anchor}
                    chat={chat}
                    initialThreadChatId={initialThreadChatId}
                    key={anchor.id}
                    onClose={onClose}
                    onOpenArtifact={onOpenArtifact}
                    onViewInChannel={onViewInChannel}
                    readOnly={readOnly}
                    summary={summary}
                    takeover={takeover}
                    width={width}
                />
            )}
        </ChatSidePaneShell>
    );
}

function ThreadContent({
    active,
    anchor,
    chat,
    initialThreadChatId,
    onClose,
    onOpenArtifact,
    onViewInChannel,
    readOnly,
    summary,
    takeover,
    width,
}: {
    active: boolean;
    anchor: HostedChatMessage;
    chat: HostedChat;
    initialThreadChatId?: string;
    onClose: () => void;
    onOpenArtifact: (target: TavernResourceTarget) => void;
    onViewInChannel: () => void;
    readOnly: boolean;
    summary: HostedThreadSummary | null;
    takeover: boolean;
    width: number | null;
}) {
    const [createdThreadChatId, setCreatedThreadChatId] = React.useState<string | null>(null);
    const threadChatId =
        summary?.threadChatId ?? createdThreadChatId ?? initialThreadChatId ?? undefined;
    const messages = useThreadMessages(chat.serverId, threadChatId);
    const replies = messages.messages;
    const lastSequence = replies.at(-1)?.sequence ?? 0;
    const replyCount = Math.max(summary?.replyCount ?? 0, replies.length);
    const follow = useThreadFollow(chat.id);
    const humans = useHumanDirectory(chat.serverId);
    const viewerUserId = useMembers(chat.serverId).data?.viewerUserId;
    const titles = threadTitles(chat, anchor.id, humans);
    // Replies show as pending rows the instant they are sent, under a key the
    // anchor owns, so the very first reply — which has no Thread chat id until
    // its receipt lands — is carried the same way every later one is.
    const pendingReplies = usePendingChatMessages(pendingThreadReplyKey(anchor.id), replies);
    // The thread renders through the same hosted transcript wiring as the
    // main chat, so anchor and replies look and feel like channel rows.
    const threadMessages = React.useMemo(() => [anchor, ...replies], [anchor, replies]);
    const { renderContext, rows } = useChatTranscript({
        chatId: threadChatId ?? chat.id,
        messages: threadMessages,
        onOpenArtifact,
        serverId: chat.serverId,
    });
    const anchorEntries = React.useMemo(
        () => buildTranscriptEntries({ rows: rows.slice(0, 1) }),
        [rows]
    );
    const replyEntries = React.useMemo(
        () => buildTranscriptEntries({ rows: rows.slice(1) }),
        [rows]
    );

    useChatRead({
        chatId: messages.data ? threadChatId : undefined,
        enabled: active,
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });

    return (
        <div
            className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
            style={width ? { width } : undefined}
        >
            <ThreadPanelHeader
                followed={summary?.followed ?? true}
                followPending={follow.isPending}
                header={titles.header}
                onBack={onClose}
                onClose={onClose}
                onFollowChange={(next) => {
                    if (threadChatId) {
                        follow.mutate({
                            follow: next,
                            serverId: chat.serverId,
                            threadChatId,
                        });
                    }
                }}
                onViewInChannel={onViewInChannel}
                takeover={takeover}
                target={titles.target}
                threadExists={threadChatId !== undefined}
            />
            <TranscriptRenderProvider value={renderContext}>
                {/* px-5 matches the main chat viewport gutter so the
                            rows' full-width hover bleed stays contained. */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {anchorEntries.map((entry) => (
                        <TranscriptEntryView
                            activeReply={null}
                            conversationLayout={renderContext.conversationLayout}
                            entry={entry}
                            key={entry.id}
                        />
                    ))}
                    <ReplyDivider replyCount={replyCount} />
                    {messages.hasOlderHistory ? (
                        <div className="mb-5 flex justify-center">
                            <Button
                                isDisabled={messages.isFetchingOlderHistory}
                                onPress={() => void messages.fetchOlderHistory()}
                                size="sm"
                                variant="ghost"
                            >
                                {messages.isFetchingOlderHistory
                                    ? 'Loading older replies…'
                                    : 'Load older replies'}
                            </Button>
                        </div>
                    ) : null}
                    <div className="flex min-w-0 flex-col">
                        {replyEntries.map((entry) => (
                            <TranscriptEntryView
                                activeReply={null}
                                conversationLayout={renderContext.conversationLayout}
                                entry={entry}
                                key={entry.id}
                            />
                        ))}
                        {viewerUserId ? (
                            <PendingChatMessages
                                messages={pendingReplies}
                                serverId={chat.serverId}
                                viewerUserId={viewerUserId}
                            />
                        ) : null}
                        <ChatAgentComposition chatId={threadChatId} serverId={chat.serverId} />
                    </div>
                </div>
            </TranscriptRenderProvider>
            {readOnly ? (
                <p className="shrink-0 border-separator border-t px-4 py-3 text-muted text-xs">
                    This conversation is read-only because the Agent has been retired.
                </p>
            ) : (
                <ChatComposer
                    chatId={chat.id}
                    chatName={titles.header}
                    compositionChatId={threadChatId}
                    onThreadCreated={setCreatedThreadChatId}
                    pendingChatId={pendingThreadReplyKey(anchor.id)}
                    placeholder="Add a reply…"
                    serverId={chat.serverId}
                    thread={{ anchorMessageId: anchor.id }}
                />
            )}
        </div>
    );
}

function ReplyDivider({ replyCount }: { replyCount: number }) {
    if (replyCount === 0) {
        return <div className="py-8 text-center text-muted text-sm">No replies yet</div>;
    }

    return (
        <div className="my-5 flex items-center gap-3 text-center text-muted text-xs">
            <div className="h-px flex-1 bg-separator" />
            <div>
                <div>Beginning of replies</div>
                <div>{`${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`}</div>
            </div>
            <div className="h-px flex-1 bg-separator" />
        </div>
    );
}
