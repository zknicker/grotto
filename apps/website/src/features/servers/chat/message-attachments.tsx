import { Attachment01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAttachmentMetadata } from '@tavern/api';
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

export function MessageAttachments({
    attachments,
    disabled,
    onDownload,
}: {
    attachments: HostedAttachmentMetadata[];
    disabled: boolean;
    onDownload: (attachment: HostedAttachmentMetadata) => void;
}) {
    return (
        <AttachmentGroup>
            {attachments.map((attachment) => (
                <Attachment key={attachment.id} size="sm">
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
            ))}
        </AttachmentGroup>
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
