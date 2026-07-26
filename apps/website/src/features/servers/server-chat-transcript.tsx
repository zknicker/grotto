import type { HostedChatMessage } from '@tavern/api';
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

export function ServerChatTranscript({
    messages,
    onStartDm,
}: {
    messages: HostedChatMessage[] | undefined;
    onStartDm: (userId: string) => void;
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
                            messages.map((message) => (
                                <MessageScrollerItem
                                    data-hosted-message-sequence={message.sequence}
                                    key={message.id}
                                >
                                    <article className="flex min-w-0 flex-col gap-1">
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
                                    </article>
                                </MessageScrollerItem>
                            ))
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
