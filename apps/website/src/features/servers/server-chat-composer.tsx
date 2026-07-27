import { Attachment01Icon, Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentGroup,
    AttachmentTitle,
} from '../../components/ui/attachment.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputHeader,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { useSendServerChatMessage } from '../../hooks/servers/use-send-server-chat-message.ts';
import { useServerChatComposition } from '../../hooks/servers/use-server-chat-composition.ts';
import {
    hostedAttachmentMaxSizeBytes,
    useUploadServerAttachment,
} from '../../hooks/servers/use-upload-server-attachment.ts';

interface SelectedAttachment {
    file: File;
    nonce: string;
}

export function ServerChatComposer({
    chatId,
    chatName,
    serverId,
}: {
    chatId: string;
    chatName: string;
    serverId: string;
}) {
    const [draft, setDraft] = React.useState('');
    const [attachments, setAttachments] = React.useState<SelectedAttachment[]>([]);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const [compositionId] = React.useState(() => crypto.randomUUID());
    const fileInput = React.useRef<HTMLInputElement>(null);
    const send = useSendServerChatMessage();
    const upload = useUploadServerAttachment();
    const composition = useServerChatComposition(serverId, chatId);
    const publishComposition = composition.publish.mutate;

    React.useEffect(() => {
        if (draft.length === 0) {
            return;
        }

        const timeout = window.setTimeout(() => {
            publishComposition({
                chatId,
                compositionId,
                serverId,
                text: draft,
            });
        }, 150);

        return () => window.clearTimeout(timeout);
    }, [chatId, compositionId, draft, publishComposition, serverId]);

    React.useEffect(
        () => () => {
            publishComposition({ chatId, compositionId, serverId, text: null });
        },
        [chatId, compositionId, publishComposition, serverId]
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const content = draft.trim();

        if (
            (content.length === 0 && attachments.length === 0) ||
            send.isPending ||
            upload.isPending
        ) {
            return;
        }

        const uploaded = await Promise.all(
            attachments.map(({ file, nonce }) =>
                upload.mutateAsync({ chatId, file, nonce, serverId })
            )
        );
        await send.mutateAsync({
            attachmentIds: uploaded.map((attachment) => attachment.id),
            chatId,
            content,
            nonce: crypto.randomUUID(),
            serverId,
        });
        setDraft('');
        setAttachments([]);
        setAttachmentError(null);
        if (fileInput.current) {
            fileInput.current.value = '';
        }
        publishComposition({ chatId, compositionId, serverId, text: null });
    };

    const isPending = send.isPending || upload.isPending;

    return (
        <div>
            {composition.compositions.length > 0 ? (
                <p className="mx-auto mb-1 w-full max-w-[60rem] px-9 text-muted-foreground text-xs">
                    Someone is typing…
                </p>
            ) : null}
            <PromptInput
                error={attachmentError ?? upload.error?.message ?? send.error?.message}
                onSubmit={handleSubmit}
            >
                {attachments.length > 0 ? (
                    <PromptInputHeader>
                        <AttachmentGroup>
                            {attachments.map((attachment) => (
                                <Attachment key={attachment.nonce} size="sm">
                                    <AttachmentContent>
                                        <AttachmentTitle>{attachment.file.name}</AttachmentTitle>
                                        <AttachmentDescription>
                                            {formatBytes(attachment.file.size)}
                                        </AttachmentDescription>
                                    </AttachmentContent>
                                    <AttachmentActions>
                                        <AttachmentAction
                                            aria-label={`Remove ${attachment.file.name}`}
                                            disabled={isPending}
                                            onClick={() =>
                                                setAttachments((current) =>
                                                    current.filter(
                                                        (item) => item.nonce !== attachment.nonce
                                                    )
                                                )
                                            }
                                        >
                                            <Icon className="size-3" icon={Cancel01Icon} />
                                        </AttachmentAction>
                                    </AttachmentActions>
                                </Attachment>
                            ))}
                        </AttachmentGroup>
                    </PromptInputHeader>
                ) : null}
                <PromptInputBody>
                    <PromptInputTextarea
                        aria-label={`Message ${chatName}`}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={`Message ${chatName}`}
                        value={draft}
                    />
                </PromptInputBody>
                <PromptInputFooter>
                    <PromptInputTools>
                        <input
                            className="sr-only"
                            multiple
                            onChange={(event) => {
                                const files = Array.from(event.target.files ?? []);
                                const oversized = files.find(
                                    (file) => file.size > hostedAttachmentMaxSizeBytes
                                );
                                if (oversized) {
                                    setAttachmentError(
                                        `${oversized.name} exceeds the 50 MiB attachment limit.`
                                    );
                                    event.target.value = '';
                                    return;
                                }
                                setAttachmentError(null);
                                setAttachments((current) => [
                                    ...current,
                                    ...files.map((file) => ({
                                        file,
                                        nonce: crypto.randomUUID(),
                                    })),
                                ]);
                            }}
                            ref={fileInput}
                            type="file"
                        />
                        <PromptInputButton
                            aria-label="Add attachments"
                            disabled={isPending}
                            onClick={() => fileInput.current?.click()}
                            size="icon-xs"
                            tooltip="Add attachments"
                            type="button"
                            variant="ghost"
                        >
                            <Icon className="size-4" icon={Attachment01Icon} />
                        </PromptInputButton>
                    </PromptInputTools>
                    <PromptInputActions>
                        <PromptInputSubmit
                            canSubmit={draft.trim().length > 0 || attachments.length > 0}
                            disabled={isPending}
                        />
                    </PromptInputActions>
                </PromptInputFooter>
            </PromptInput>
        </div>
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
