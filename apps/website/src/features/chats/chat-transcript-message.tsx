import { FileTextIcon } from 'lucide-react';
import * as React from 'react';
import { Alert, AlertTitle } from '../../components/ui/alert.tsx';
import {
    Attachment,
    AttachmentContent,
    AttachmentDescription,
    AttachmentMedia,
    AttachmentTitle,
    AttachmentTrigger,
} from '../../components/ui/attachment.tsx';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    applyAgentMentionAppearance,
    readMentionsFromMarkdown,
} from '../mentions/mention-metadata.ts';
import { CollapsibleText } from '../rows/collapsible-text.tsx';
import { getMessageDisplay } from '../rows/message-display.ts';
import type { ChatTextAnimationRange } from './chat-inline-text-animation.tsx';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import { ChatMessageImage } from './chat-message-image.tsx';

export type TranscriptMessage =
    | Extract<NonNullable<ChatLogOutput>['rows'][number], { kind: 'message' }>['message']
    | Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['message'];

type MessageAttachment = NonNullable<TranscriptMessage['attachments']>[number];

export function ChatTranscriptMessageContent({
    animatedRanges,
    contentOverride,
    message,
    textClassName,
}: {
    animatedRanges?: readonly ChatTextAnimationRange[];
    contentOverride?: string;
    message: TranscriptMessage;
    textClassName?: string;
}) {
    const messageDisplay = getMessageDisplay(message);
    const isErrorEvent =
        message.senderType === 'agent' &&
        messageDisplay.content.length === 0 &&
        message.metadata?.stopReason === 'error';
    const content = contentOverride ?? messageDisplay.content;
    const lookupAgentAppearance = useAgentAppearanceLookup();
    const mentions = React.useMemo(
        () => applyAgentMentionAppearance(readMentionsFromMarkdown(content), lookupAgentAppearance),
        [content, lookupAgentAppearance]
    );

    if (isErrorEvent) {
        return (
            <Alert variant="error">
                <AlertTitle>Error - session ended unexpectedly</AlertTitle>
            </Alert>
        );
    }

    if (!messageDisplay.showBodyContent) {
        return null;
    }

    return (
        <CollapsibleText className={cn('text-sm', textClassName ?? 'text-foreground')}>
            <ChatMarkdownText
                animatedRanges={animatedRanges}
                content={content}
                mentions={mentions}
            />
        </CollapsibleText>
    );
}

export function getTranscriptMessageContent(message: TranscriptMessage) {
    const messageDisplay = getMessageDisplay(message);

    return messageDisplay.showBodyContent ? messageDisplay.content : '';
}

export function ChatTranscriptMessageAttachments({
    attachments,
}: {
    attachments: MessageAttachment[];
}) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <>
            {attachments.map((attachment) => {
                if (attachment.type === 'file') {
                    return <MessageFileReference attachment={attachment} key={attachment.path} />;
                }

                if (isImageAttachment(attachment)) {
                    return <ChatMessageImage attachment={attachment} key={attachment.filename} />;
                }

                const dataUrl = `data:${attachment.mediaType};base64,${attachment.dataBase64}`;

                return (
                    <Attachment key={attachment.filename}>
                        <AttachmentMedia>
                            <FileTextIcon />
                        </AttachmentMedia>
                        <AttachmentContent>
                            <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                            <AttachmentDescription>{attachment.mediaType}</AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentTrigger
                            aria-label={`Download ${attachment.filename}`}
                            render={
                                <a download={attachment.filename} href={dataUrl}>
                                    <span className="sr-only">Download {attachment.filename}</span>
                                </a>
                            }
                        />
                    </Attachment>
                );
            })}
        </>
    );
}

export function renderTranscriptMessageAttachments(
    attachments: MessageAttachment[] | null | undefined
) {
    if (!attachments || attachments.length === 0) {
        return null;
    }

    return <ChatTranscriptMessageAttachments attachments={attachments} />;
}

function MessageFileReference({
    attachment,
}: {
    attachment: Extract<MessageAttachment, { type: 'file' }>;
}) {
    const description = getFileAttachmentDescription(attachment);

    return (
        <Attachment>
            <AttachmentMedia>
                <FileTextIcon />
            </AttachmentMedia>
            <AttachmentContent>
                <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                {description ? <AttachmentDescription>{description}</AttachmentDescription> : null}
                <AttachmentDescription className="font-mono">
                    {attachment.path}
                </AttachmentDescription>
            </AttachmentContent>
        </Attachment>
    );
}

function getFileAttachmentDescription(attachment: Extract<MessageAttachment, { type: 'file' }>) {
    const parts = ['File reference'];

    if (attachment.sizeBytes !== null && attachment.sizeBytes !== undefined) {
        parts.push(formatAttachmentBytes(attachment.sizeBytes));
    }

    if (attachment.mediaType) {
        parts.push(attachment.mediaType);
    }

    return parts.join(' - ');
}

function isImageAttachment(attachment: Extract<MessageAttachment, { type: 'inline' }>) {
    return (
        attachment.type === 'inline' &&
        ['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(attachment.mediaType)
    );
}

function formatAttachmentBytes(sizeBytes: number) {
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }

    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
