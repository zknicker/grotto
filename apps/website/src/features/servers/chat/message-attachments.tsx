import type { AttachmentMetadata } from '@grotto/api';
import { Tooltip } from '@heroui/react';
import { ChatAttachment } from '@heroui-pro/react';
import { Attachment01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentGroup,
    AttachmentMedia,
    AttachmentTitle,
} from '../../../components/chats/attachment.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAttachmentPreview } from '../../../hooks/servers/use-attachment-preview.ts';

const emptyImagePreview = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function MessageAttachments({
    attachments,
    disabled,
    onDownload,
    serverId,
}: {
    attachments: AttachmentMetadata[];
    disabled: boolean;
    onDownload: (attachment: AttachmentMetadata) => void;
    serverId: string;
}) {
    return (
        <AttachmentGroup>
            {attachments.map((attachment) =>
                isPreviewableImage(attachment) ? (
                    <HostedImageAttachment
                        attachment={attachment}
                        disabled={disabled}
                        key={attachment.id}
                        onDownload={onDownload}
                        serverId={serverId}
                    />
                ) : (
                    <HostedFileAttachment
                        attachment={attachment}
                        disabled={disabled}
                        key={attachment.id}
                        onDownload={onDownload}
                    />
                )
            )}
        </AttachmentGroup>
    );
}

function HostedImageAttachment({
    attachment,
    disabled,
    onDownload,
    serverId,
}: {
    attachment: AttachmentMetadata;
    disabled: boolean;
    onDownload: (attachment: AttachmentMetadata) => void;
    serverId: string;
}) {
    const preview = useAttachmentPreview({ attachmentId: attachment.id, serverId });

    if (preview.failed) {
        return (
            <HostedFileAttachment
                attachment={attachment}
                disabled={disabled}
                onDownload={onDownload}
            />
        );
    }

    return (
        <ChatAttachment
            className="group/hosted-image"
            mediaType="image"
            mimeType={attachment.mediaType}
            name={attachment.filename}
            size={attachment.sizeBytes}
            src={preview.url ?? emptyImagePreview}
        >
            <ChatAttachment.Preview />
            <ChatAttachment.Name />
            <Tooltip>
                <AttachmentAction
                    aria-label={`Download ${attachment.filename}`}
                    className="absolute end-1.5 top-1.5 z-20 opacity-70 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/hosted-image:opacity-100 [@media(hover:hover)]:group-hover/hosted-image:opacity-100"
                    isDisabled={disabled}
                    onPress={() => onDownload(attachment)}
                    variant="secondary"
                >
                    <Icon className="size-3.5" icon={Download04Icon} />
                </AttachmentAction>
                <Tooltip.Content>Download</Tooltip.Content>
            </Tooltip>
        </ChatAttachment>
    );
}

function HostedFileAttachment({
    attachment,
    disabled,
    onDownload,
}: {
    attachment: AttachmentMetadata;
    disabled: boolean;
    onDownload: (attachment: AttachmentMetadata) => void;
}) {
    return (
        <Attachment size="sm">
            <AttachmentMedia>
                <Icon icon={Attachment01Icon} />
            </AttachmentMedia>
            <AttachmentContent>
                <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                <AttachmentDescription>
                    {attachment.mediaType} · {formatBytes(attachment.sizeBytes)}
                </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
                <AttachmentAction
                    aria-label={`Download ${attachment.filename}`}
                    isDisabled={disabled}
                    onPress={() => onDownload(attachment)}
                >
                    <Icon className="size-3.5" icon={Download04Icon} />
                </AttachmentAction>
            </AttachmentActions>
        </Attachment>
    );
}

export function isPreviewableImage(attachment: AttachmentMetadata) {
    return attachment.mediaType.startsWith('image/');
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
