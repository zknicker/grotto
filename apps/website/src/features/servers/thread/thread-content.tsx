import type { Chat, ChatMessage, ThreadSummary } from '@grotto/api';
import { Button } from '@heroui/react';
import * as React from 'react';
import { useChatRead } from '../../../hooks/servers/use-chat-read.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useMembers } from '../../../hooks/servers/use-members.ts';
import { useThreadFollow } from '../../../hooks/servers/use-thread-follow.ts';
import { useThreadMessages } from '../../../hooks/servers/use-thread-messages.ts';
import { buildTranscriptEntries } from '../../chats/chat-transcript-model.ts';
import { TranscriptRenderProvider } from '../../chats/chat-transcript-render-context.tsx';
import { TranscriptEntryView } from '../../chats/chat-transcript-turn.tsx';
import type { GrottoResourceTarget } from '../../chats/grotto-resource-link.ts';
import { ThreadPanelHeader } from '../../chats/thread/thread-panel-header.tsx';
import { ChatAgentComposition } from '../chat/agent-composition.tsx';
import { ChatComposer } from '../chat/chat-composer-variants.tsx';
import { useChatTranscript } from '../chat/chat-transcript.tsx';
import { pendingThreadReplyKey, usePendingChatMessages } from '../chat/use-pending-messages.ts';
import { TaskThreadMetadata } from '../tasks/task-thread-metadata.tsx';
import { threadTitles } from './thread-target.ts';

/**
 * The full Thread work surface — header, task metadata, anchor, replies, and
 * composer. The chat page hosts it in the shell side pane (`ThreadPanel`);
 * the Tasks page hosts it in the task thread dialog.
 */
export function ThreadContent({
    active,
    anchor,
    chat,
    composerVariant = 'primary',
    headerTitle,
    initialThreadChatId,
    onClose,
    onOpenArtifact,
    onViewInChannel,
    readOnly,
    summary,
    takeover,
    turnDetailsAccess,
    width,
}: {
    active: boolean;
    anchor: ChatMessage;
    chat: Chat;
    /** `secondary` when the host is a surface (the task dialog). */
    composerVariant?: 'primary' | 'secondary';
    /**
     * Overrides the derived "Thread — <chat>" title. The task dialog names the
     * task it opened, since that is the identity the reader came for.
     */
    headerTitle?: string;
    initialThreadChatId?: string;
    onClose: () => void;
    onOpenArtifact: (target: GrottoResourceTarget) => void;
    onViewInChannel: () => void;
    readOnly: boolean;
    summary: ThreadSummary | null;
    takeover: boolean;
    turnDetailsAccess: 'journal' | 'summary';
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
    // The thread renders through the same Server transcript wiring as the
    // main chat, so anchor and replies look and feel like channel rows.
    const threadMessages = React.useMemo(() => [anchor, ...replies], [anchor, replies]);
    const { renderContext, rows } = useChatTranscript({
        chatId: threadChatId ?? chat.id,
        messages: threadMessages,
        onOpenArtifact,
        pendingMessages: pendingReplies,
        serverId: chat.serverId,
        // The metadata panel above the anchor already states the task.
        taskChipHidden: Boolean(anchor.task),
        turnDetailsAccess,
        viewerUserId,
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
                header={headerTitle ?? titles.header}
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
                    {anchor.task ? (
                        <TaskThreadMetadata
                            chat={chat}
                            chatId={chat.id}
                            fallbackTask={anchor.task}
                            messageId={anchor.id}
                        />
                    ) : null}
                    {anchorEntries.map((entry) => (
                        <TranscriptEntryView
                            activeReply={null}
                            conversationLayout={renderContext.conversationLayout}
                            entry={entry}
                            key={entry.id}
                        />
                    ))}
                    {replyCount === 0 ? (
                        <div className="py-8 text-center text-muted text-sm">No replies yet</div>
                    ) : null}
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
                        <ChatAgentComposition chatId={threadChatId} serverId={chat.serverId} />
                    </div>
                </div>
            </TranscriptRenderProvider>
            {readOnly ? (
                <p className="shrink-0 border-separator border-t px-4 py-3 text-muted text-sm">
                    This conversation is read-only because the Agent has been retired.
                </p>
            ) : (
                <ChatComposer
                    chatId={chat.id}
                    chatName={titles.header}
                    onThreadCreated={setCreatedThreadChatId}
                    pendingChatId={pendingThreadReplyKey(anchor.id)}
                    placeholder="Add a reply…"
                    serverId={chat.serverId}
                    thread={{ anchorMessageId: anchor.id }}
                    variant={composerVariant}
                />
            )}
        </div>
    );
}
