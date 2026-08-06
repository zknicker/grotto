import { ChatAttachment, ChatAttachmentGroup, PromptInput } from '@heroui-pro/react';
import type { ComposerAttachment } from './use-composer-attachments.ts';

export function ComposerAttachments({
    attachments,
    disabled,
    onRemove,
}: {
    attachments: ComposerAttachment[];
    disabled: boolean;
    onRemove: (nonce: string) => void;
}) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <PromptInput.Attachments>
            <ChatAttachmentGroup>
                {attachments.map((attachment) => (
                    <ChatAttachment
                        key={attachment.nonce}
                        mimeType={attachment.file.type}
                        name={attachment.file.name}
                        src={attachment.previewUrl}
                        title={`${attachment.file.name} - ${formatBytes(attachment.file.size)}`}
                    >
                        <ChatAttachment.Preview />
                        <ChatAttachment.Name />
                        <ChatAttachment.Remove
                            aria-label={`Remove ${attachment.file.name}`}
                            isDisabled={disabled}
                            onPress={() => onRemove(attachment.nonce)}
                        />
                    </ChatAttachment>
                ))}
            </ChatAttachmentGroup>
        </PromptInput.Attachments>
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
