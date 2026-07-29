import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../../components/ui/icon.tsx';
import { usePromptInputTextEditorFocus } from '../../components/ui/prompt-input.tsx';
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
        <div className="mx-1 mb-2 flex flex-wrap items-start gap-2">
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
                        <ChatComposerAttachmentPreview
                            attachment={attachment}
                            onRemove={() => onRemove(index)}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

function ChatComposerAttachmentPreview({
    attachment,
    onRemove,
}: {
    attachment: ChatComposerAttachment;
    onRemove: () => void;
}) {
    const isImage = attachment.type === 'inline' && attachment.mediaType.startsWith('image/');
    const focusTextEditor = usePromptInputTextEditorFocus();

    return (
        <div
            className="group/tile relative size-20 shrink-0 cursor-default overflow-hidden rounded-xl border border-input bg-background"
            title={`${attachment.filename} - ${attachmentDetail(attachment)}`}
        >
            {isImage ? (
                <img
                    alt=""
                    className="size-full object-cover"
                    height={80}
                    src={`data:${attachment.mediaType};base64,${attachment.dataBase64}`}
                    width={80}
                />
            ) : (
                <div className="grid size-full place-items-center bg-muted text-meta text-muted-foreground">
                    {fileExtension(attachment.filename)}
                </div>
            )}
            <button
                aria-label={`Remove ${attachment.filename}`}
                className="absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 outline-none transition-opacity duration-80 hover:bg-primary-deep focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring group-hover/tile:opacity-100"
                onClick={(event) => {
                    event.stopPropagation();
                    onRemove();
                    focusTextEditor();
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
            >
                <Icon className="size-3" icon={Cancel01Icon} />
            </button>
        </div>
    );
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

function fileExtension(filename: string) {
    const extension = filename.split('.').pop()?.trim().slice(0, 4).toUpperCase();
    return extension || 'FILE';
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
