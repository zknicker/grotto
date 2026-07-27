import type { HostedChat, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useMarkServerChatReadOnView } from '../../../hooks/servers/use-mark-server-chat-read.ts';
import { useServerThreadMessages } from '../../../hooks/servers/use-server-thread-messages.ts';
import { useSetServerThreadFollow } from '../../../hooks/servers/use-set-server-thread-follow.ts';
import { ChatMarkdownText } from '../../chats/chat-markdown-text.tsx';
import { ChatSidePaneShell } from '../../chats/chat-side-pane-shell.tsx';
import { ThreadPanelHeader } from '../../chats/thread/thread-panel-header.tsx';
import { ServerChatComposer } from '../server-chat-composer.tsx';
import { serverThreadTitles } from './server-thread-target.ts';

export function ServerThreadPanel({
    anchor,
    chat,
    onClose,
    onViewInChannel,
    summary,
    takeover,
}: {
    anchor: HostedChatMessage;
    chat: HostedChat;
    onClose: () => void;
    onViewInChannel: () => void;
    summary: HostedThreadSummary | null;
    takeover: boolean;
}) {
    const [createdThreadChatId, setCreatedThreadChatId] = React.useState<string | null>(null);
    const threadChatId = summary?.threadChatId ?? createdThreadChatId ?? undefined;
    const messages = useServerThreadMessages(chat.serverId, threadChatId);
    const replies = messages.messages;
    const lastSequence = replies.at(-1)?.sequence ?? 0;
    const replyCount = Math.max(summary?.replyCount ?? 0, replies.length);
    const follow = useSetServerThreadFollow(chat.id);
    const titles = serverThreadTitles(chat, anchor.id);

    useMarkServerChatReadOnView({
        chatId: messages.data ? threadChatId : undefined,
        sequence: messages.data ? lastSequence : undefined,
        serverId: messages.data ? chat.serverId : undefined,
    });

    return (
        <ChatSidePaneShell label="Thread" open takeover={takeover}>
            {(width) => (
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
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                        <ThreadMessage message={anchor} />
                        <ReplyDivider replyCount={replyCount} />
                        {messages.hasOlderHistory ? (
                            <div className="mb-5 flex justify-center">
                                <Button
                                    disabled={messages.isFetchingOlderHistory}
                                    onClick={() => void messages.fetchOlderHistory()}
                                    size="sm"
                                    variant="ghost"
                                >
                                    {messages.isFetchingOlderHistory
                                        ? 'Loading older replies…'
                                        : 'Load older replies'}
                                </Button>
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-5">
                            {replies.map((reply) => (
                                <ThreadMessage key={reply.id} message={reply} />
                            ))}
                        </div>
                    </div>
                    <div className="shrink-0 border-border/70 border-t py-3">
                        <ServerChatComposer
                            chatId={chat.id}
                            chatName={titles.header}
                            compositionChatId={threadChatId}
                            onThreadCreated={setCreatedThreadChatId}
                            placeholder="Message thread"
                            serverId={chat.serverId}
                            thread={{ anchorMessageId: anchor.id }}
                        />
                    </div>
                </div>
            )}
        </ChatSidePaneShell>
    );
}

function ThreadMessage({ message }: { message: HostedChatMessage }) {
    return (
        <article className="flex min-w-0 flex-col gap-1">
            <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">
                    {message.author.kind === 'human'
                        ? `Human ${message.author.userId.slice(-6)}`
                        : 'Reminder'}
                </span>
                <time className="text-muted-foreground text-xs" dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                    })}
                </time>
            </div>
            <div className="text-foreground text-sm">
                <ChatMarkdownText content={message.content} />
            </div>
        </article>
    );
}

function ReplyDivider({ replyCount }: { replyCount: number }) {
    if (replyCount === 0) {
        return <div className="py-8 text-center text-muted-foreground text-sm">No replies yet</div>;
    }

    return (
        <div className="my-5 flex items-center gap-3 text-center text-meta text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <div>
                <div>Beginning of replies</div>
                <div>{`${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`}</div>
            </div>
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}
