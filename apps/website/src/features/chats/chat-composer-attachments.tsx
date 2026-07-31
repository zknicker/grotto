import { ChatAttachment, ChatAttachmentGroup } from '@heroui-pro/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { springs } from '../../lib/springs.ts';
import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';

export type ChatComposerInlineAttachment = Extract<ChatMessageAttachmentInput, { type: 'inline' }>;

export type ChatComposerAttachment = ChatMessageAttachmentInput;

export async function readComposerAttachment(file: File): Promise<ChatComposerAttachment> {
    const dataUrl = await readFileAsDataUrl(file);
    const separator = dataUrl.indexOf(',');

    if (separator < 0) {
        throw new Error(`Could not read ${file.name}.`);
    }

    return {
        dataBase64: dataUrl.slice(separator + 1),
        filename: file.name,
        mediaType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        type: 'inline',
    };
}

export function ChatComposerAttachmentList({
    attachments,
    onRemove,
}: {
    attachments: readonly ChatComposerAttachment[];
    onRemove: (index: number) => void;
}) {
    const shouldReduceMotion = useReducedMotion();

    if (attachments.length === 0) {
        return null;
    }

    return (
        <ChatAttachmentGroup>
            <AnimatePresence initial={false}>
                {attachments.map((attachment, index) => (
                    <motion.div
                        animate={{
                            opacity: 1,
                            transform: 'translateY(0) scale(1)',
                        }}
                        exit={
                            shouldReduceMotion
                                ? { opacity: 0, transition: springs.fast }
                                : {
                                      opacity: 0,
                                      transform: 'translateY(-2px) scale(0.98)',
                                      transition: springs.fast,
                                  }
                        }
                        initial={
                            shouldReduceMotion
                                ? { opacity: 0 }
                                : {
                                      opacity: 0,
                                      transform: 'translateY(6px) scale(0.96)',
                                  }
                        }
                        key={attachmentKey(attachment, index)}
                        layout={!shouldReduceMotion}
                        style={{ transformOrigin: 'top left' }}
                        transition={springs.moderate}
                    >
                        <ChatAttachment
                            mimeType={attachment.mediaType ?? undefined}
                            name={attachment.filename}
                            src={attachmentPreviewSrc(attachment)}
                            title={`${attachment.filename} - ${attachmentDetail(attachment)}`}
                        >
                            <ChatAttachment.Preview />
                            <ChatAttachment.Name />
                            <ChatAttachment.Remove
                                aria-label={`Remove ${attachment.filename}`}
                                onPress={() => onRemove(index)}
                            />
                        </ChatAttachment>
                    </motion.div>
                ))}
            </AnimatePresence>
        </ChatAttachmentGroup>
    );
}

function attachmentPreviewSrc(attachment: ChatComposerAttachment) {
    if (attachment.type !== 'inline' || !attachment.mediaType.startsWith('image/')) {
        return undefined;
    }

    return `data:${attachment.mediaType};base64,${attachment.dataBase64}`;
}

function attachmentKey(attachment: ChatComposerAttachment, index: number) {
    if (attachment.type === 'inline') {
        return `${attachment.type}:${attachment.filename}:${attachment.sizeBytes}:${attachment.dataBase64.slice(0, 24)}:${index}`;
    }

    return `${attachment.type}:${attachment.filename}:${attachment.path}:${index}`;
}

function attachmentDetail(attachment: ChatComposerAttachment) {
    if (attachment.type === 'inline') {
        return formatBytes(attachment.sizeBytes);
    }

    return attachment.sizeBytes === null || attachment.sizeBytes === undefined
        ? (attachment.path ?? 'File')
        : formatBytes(attachment.sizeBytes);
}

function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }

            reject(new Error(`Could not read ${file.name}.`));
        };
        reader.readAsDataURL(file);
    });
}

function formatBytes(value: number) {
    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
