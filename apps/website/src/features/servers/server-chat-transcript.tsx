import { BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import { Icon } from '../../components/ui/icon.tsx';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/ui/message-scroller.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ChatMarkdownText } from '../chats/chat-markdown-text.tsx';
import { ThreadReplyPill } from '../chats/thread/thread-reply-pill.tsx';

export function ServerChatTranscript({
    activeThreadAnchorId,
    messages,
    onOpenThread,
    onStartDm,
    threads = [],
}: {
    activeThreadAnchorId?: string;
    messages: HostedChatMessage[] | undefined;
    onOpenThread?: (message: HostedChatMessage, summary: HostedThreadSummary | null) => void;
    onStartDm: (userId: string) => void;
    threads?: HostedThreadSummary[];
}) {
    if (!messages) {
        return null;
    }

    return (
        <MessageScrollerProvider>
            <MessageScroller>
                <MessageScrollerViewport>
                    <MessageScrollerContent className="mx-auto w-full max-w-[60rem] px-6 py-6">
                        {messages.length === 0 ? (
                            <p className="my-auto text-center text-muted-foreground text-sm">
                                No messages yet.
                            </p>
                        ) : (
                            messages.map((message) => {
                                const thread =
                                    threads.find(
                                        (summary) => summary.anchorMessageId === message.id
                                    ) ?? null;

                                return (
                                    <MessageScrollerItem
                                        data-hosted-message-sequence={message.sequence}
                                        id={`hosted-message-${message.id}`}
                                        key={message.id}
                                    >
                                        <article
                                            className={`group relative flex min-w-0 flex-col gap-1 rounded-lg p-2 ${
                                                activeThreadAnchorId === message.id
                                                    ? 'bg-active ring-1 ring-brand-ring'
                                                    : ''
                                            }`}
                                        >
                                            {onOpenThread ? (
                                                <button
                                                    aria-label="Reply in thread"
                                                    className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                                                    onClick={() => onOpenThread(message, thread)}
                                                    type="button"
                                                >
                                                    <Icon
                                                        className="size-4"
                                                        icon={BubbleChatIcon}
                                                    />
                                                </button>
                                            ) : null}
                                            <div className="flex items-baseline gap-2">
                                                <Button
                                                    className="h-auto p-0 font-medium text-sm"
                                                    onClick={() => onStartDm(message.authorUserId)}
                                                    size="xs"
                                                    variant="link"
                                                >
                                                    {shortUserId(message.authorUserId)}
                                                </Button>
                                                <time
                                                    className="text-muted-foreground text-xs"
                                                    dateTime={message.createdAt}
                                                >
                                                    {new Date(message.createdAt).toLocaleTimeString(
                                                        [],
                                                        {
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                        }
                                                    )}
                                                </time>
                                            </div>
                                            <div className="text-foreground text-sm">
                                                <ChatMarkdownText content={message.content} />
                                            </div>
                                            {thread && onOpenThread ? (
                                                <ThreadReplyPill
                                                    onClick={() => onOpenThread(message, thread)}
                                                    summary={thread}
                                                />
                                            ) : null}
                                        </article>
                                    </MessageScrollerItem>
                                );
                            })
                        )}
                    </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
            </MessageScroller>
        </MessageScrollerProvider>
    );
}

function shortUserId(userId: string) {
    return `Human ${userId.slice(-6)}`;
}
