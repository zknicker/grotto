import { Attachment01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedChatMessage } from '@tavern/api';
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentGroup,
    AttachmentMedia,
    AttachmentTitle,
} from '../../components/ui/attachment.tsx';
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
import { useDownloadServerAttachment } from '../../hooks/servers/use-download-server-attachment.ts';
import { ChatMarkdownText } from '../chats/chat-markdown-text.tsx';

export function ServerChatTranscript({
    messages,
    onStartDm,
}: {
    messages: HostedChatMessage[] | undefined;
    onStartDm: (userId: string) => void;
}) {
    const download = useDownloadServerAttachment();

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
                                        {message.content ? (
                                            <div className="text-foreground text-sm">
                                                <ChatMarkdownText content={message.content} />
                                            </div>
                                        ) : null}
                                        {message.attachments.length > 0 ? (
                                            <AttachmentGroup>
                                                {message.attachments.map((attachment) => (
                                                    <Attachment key={attachment.id} size="sm">
                                                        <AttachmentMedia>
                                                            <Icon icon={Attachment01Icon} />
                                                        </AttachmentMedia>
                                                        <AttachmentContent>
                                                            <AttachmentTitle>
                                                                {attachment.filename}
                                                            </AttachmentTitle>
                                                            <AttachmentDescription>
                                                                {attachment.mediaType} ·{' '}
                                                                {formatBytes(attachment.sizeBytes)}
                                                            </AttachmentDescription>
                                                        </AttachmentContent>
                                                        <AttachmentActions>
                                                            <AttachmentAction
                                                                aria-label={`Download ${attachment.filename}`}
                                                                disabled={download.isPending}
                                                                onClick={() =>
                                                                    download.mutate({
                                                                        attachmentId: attachment.id,
                                                                        filename:
                                                                            attachment.filename,
                                                                        serverId: message.serverId,
                                                                    })
                                                                }
                                                            >
                                                                <Icon
                                                                    className="size-3.5"
                                                                    icon={Download04Icon}
                                                                />
                                                            </AttachmentAction>
                                                        </AttachmentActions>
                                                    </Attachment>
                                                ))}
                                            </AttachmentGroup>
                                        ) : null}
                                    </article>
                                </MessageScrollerItem>
                            ))
                        )}
                        {download.error ? (
                            <p className="text-destructive text-xs">{download.error.message}</p>
                        ) : null}
                    </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
            </MessageScroller>
        </MessageScrollerProvider>
    );
}

function formatBytes(sizeBytes: number) {
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }
    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortUserId(userId: string) {
    return `Human ${userId.slice(-6)}`;
}
