import { Switch } from '@heroui/react';
import { ChatAttachment, ChatAttachmentGroup, PromptInput } from '@heroui-pro/react';
import { Attachment01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useChatComposerFocusRequest } from '../../commands/chat-composer-focus.ts';
import {
    appendComposerInsert,
    useChatComposerInsertRequest,
} from '../../commands/chat-composer-insert.ts';
import { useChatComposerMentionRequest } from '../../commands/chat-composer-mention.ts';
import { Icon } from '../../components/ui/icon.tsx';
import { useCreateServerTask } from '../../hooks/servers/use-create-server-task.ts';
import { useSendServerChatMessage } from '../../hooks/servers/use-send-server-chat-message.ts';
import { useServerChatComposition } from '../../hooks/servers/use-server-chat-composition.ts';
import {
    hostedAttachmentMaxSizeBytes,
    useUploadServerAttachment,
} from '../../hooks/servers/use-upload-server-attachment.ts';
import { buildChatComposerSubmission } from '../chats/chat-message-composer.tsx';
import type { Mention } from '../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useHostedMentionComposer,
} from '../mentions/use-mention-composer.tsx';
import { buildAgentMentionOption } from '../mentions/use-mention-options.ts';

interface SelectedAttachment {
    file: File;
    nonce: string;
    // Object URL for image tiles; revoked when the attachment leaves state.
    previewUrl?: string;
}

export function ServerChatComposer({
    agents,
    chatId,
    chatName,
    compositionChatId,
    onThreadCreated,
    placeholder,
    serverId,
    thread,
}: {
    agents: HostedAgent[];
    chatId: string;
    chatName: string;
    compositionChatId: string | undefined;
    onThreadCreated?: (threadChatId: string) => void;
    placeholder?: string;
    serverId: string;
    thread?: { anchorMessageId: string };
}) {
    const [draft, setDraft] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [asTask, setAsTask] = React.useState(false);
    const [attachments, setAttachments] = React.useState<SelectedAttachment[]>([]);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const [compositionId] = React.useState(() => crypto.randomUUID());
    const fileInput = React.useRef<HTMLInputElement>(null);
    const send = useSendServerChatMessage();
    const createTask = useCreateServerTask();
    const upload = useUploadServerAttachment();
    const composition = useServerChatComposition(serverId, compositionChatId);
    const publishComposition = composition.publish.mutate;
    const mentionableAgentIds = React.useMemo(() => agents.map((agent) => agent.id), [agents]);
    const mentionComposer = useHostedMentionComposer({
        agents,
        chatId,
        content: draft,
        mentionableAgentIds,
        onMentionsChange: setMentions,
        onSubmit: () => {
            void handleSubmit();
        },
        onSubmitAsTask: thread
            ? undefined
            : () => {
                  void handleSubmit(undefined, true);
              },
        onTextChange: setDraft,
        serverId,
    });

    useChatComposerFocusRequest(!thread, mentionComposer.focusTextEditor);
    useChatComposerInsertRequest(!thread, (text) => {
        setDraft((current) => appendComposerInsert(current, text));
        requestAnimationFrame(mentionComposer.focusTextEditor);
    });
    useChatComposerMentionRequest(thread ? null : chatId, ({ agentId }) => {
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (!agent) {
            return;
        }
        mentionComposer.handleMentionSelect(
            buildAgentMentionOption({
                agentId,
                agents: [{ id: agent.id, name: agent.displayName }],
            })
        );
    });

    React.useEffect(() => {
        if (draft.length === 0 || compositionChatId === undefined) {
            return;
        }

        const timeout = window.setTimeout(() => {
            publishComposition({
                chatId: compositionChatId,
                compositionId,
                serverId,
                text: draft,
            });
        }, 150);

        return () => window.clearTimeout(timeout);
    }, [compositionChatId, compositionId, draft, publishComposition, serverId]);

    React.useEffect(
        () => () => {
            if (compositionChatId) {
                publishComposition({
                    chatId: compositionChatId,
                    compositionId,
                    serverId,
                    text: null,
                });
            }
        },
        [compositionChatId, compositionId, publishComposition, serverId]
    );

    const attachmentsRef = React.useRef(attachments);
    attachmentsRef.current = attachments;

    React.useEffect(
        () => () => {
            for (const attachment of attachmentsRef.current) {
                revokeAttachmentPreview(attachment);
            }
        },
        []
    );

    async function handleSubmit(event?: React.FormEvent, forceAsTask = false) {
        event?.preventDefault();
        const { content } = buildChatComposerSubmission({ content: draft, mentions });
        const submitAsTask = forceAsTask || asTask;

        if (
            (content.length === 0 && attachments.length === 0) ||
            (submitAsTask && content.length === 0) ||
            send.isPending ||
            createTask.isPending ||
            upload.isPending
        ) {
            return;
        }

        if (submitAsTask && !thread) {
            await createTask.mutateAsync({
                chatId,
                content,
                nonce: crypto.randomUUID(),
                serverId,
            });
            setDraft('');
            setMentions([]);
            setAsTask(false);
            return;
        }

        const uploaded = await Promise.all(
            attachments.map(({ file, nonce }) =>
                upload.mutateAsync({ chatId, file, nonce, serverId })
            )
        );
        const receipt = await send.mutateAsync({
            attachmentIds: uploaded.map((attachment) => attachment.id),
            chatId,
            content,
            nonce: crypto.randomUUID(),
            serverId,
            thread,
        });
        if (receipt.threadChatId) {
            onThreadCreated?.(receipt.threadChatId);
        }
        setDraft('');
        setMentions([]);
        for (const attachment of attachments) {
            revokeAttachmentPreview(attachment);
        }
        setAttachments([]);
        setAttachmentError(null);
        if (fileInput.current) {
            fileInput.current.value = '';
        }
        if (compositionChatId) {
            publishComposition({
                chatId: compositionChatId,
                compositionId,
                serverId,
                text: null,
            });
        }
    }

    const isPending = send.isPending || createTask.isPending || upload.isPending;

    const errorMessage =
        attachmentError ??
        upload.error?.message ??
        createTask.error?.message ??
        send.error?.message;
    const canSubmit = draft.trim().length > 0 || (!asTask && attachments.length > 0);

    return (
        <div className="shrink-0 px-5 pb-4">
            {composition.compositions.length > 0 ? (
                <p className="mb-1 px-3 text-muted text-xs">Someone is typing…</p>
            ) : null}
            <PromptInput
                onSubmit={() => {
                    void handleSubmit();
                }}
                value={draft}
            >
                <PromptInput.Shell onMouseDown={handleShellMouseDown}>
                    <PromptInput.Content>
                        {attachments.length > 0 ? (
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
                                                isDisabled={isPending}
                                                onPress={() => removeAttachment(attachment.nonce)}
                                            />
                                        </ChatAttachment>
                                    ))}
                                </ChatAttachmentGroup>
                            </PromptInput.Attachments>
                        ) : null}
                        {/* Stands in for PromptInput.TextArea: the mention
                            editor keeps its own text styling, and the reserved
                            block below it clears the absolutely placed toolbar. */}
                        <div className="mb-14 min-h-14">
                            <MentionComposerEditor
                                ariaLabel={`Message ${chatName}`}
                                autoFocus={!thread}
                                composer={mentionComposer}
                                disabled={isPending}
                                name="chat-message"
                                placeholder={placeholder ?? `Message ${chatName}`}
                            />
                        </div>
                    </PromptInput.Content>
                    <PromptInput.Toolbar>
                        <PromptInput.ToolbarStart>
                            {thread ? null : (
                                <>
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
                                                ...files.map(createSelectedAttachment),
                                            ]);
                                        }}
                                        ref={fileInput}
                                        type="file"
                                    />
                                    <PromptInput.Action
                                        aria-label="Add attachments"
                                        isDisabled={isPending}
                                        onPress={() => fileInput.current?.click()}
                                        tooltip="Add attachments"
                                    >
                                        <Icon className="size-4" icon={Attachment01Icon} />
                                    </PromptInput.Action>
                                </>
                            )}
                        </PromptInput.ToolbarStart>
                        <PromptInput.ToolbarEnd>
                            {thread ? null : (
                                <Switch
                                    aria-label="Send as task"
                                    isSelected={asTask}
                                    onChange={setAsTask}
                                    size="sm"
                                >
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                        As Task
                                    </Switch.Content>
                                </Switch>
                            )}
                            <PromptInput.Send
                                aria-label="Send"
                                isDisabled={isPending || !canSubmit}
                            />
                        </PromptInput.ToolbarEnd>
                    </PromptInput.Toolbar>
                </PromptInput.Shell>
                {/* The picker opens above the composer, so it sits outside the
                    shell, which clips its overflow. */}
                <MentionComposerPicker composer={mentionComposer} />
            </PromptInput>
            {errorMessage ? <p className="mt-2 text-danger text-xs">{errorMessage}</p> : null}
        </div>
    );

    function removeAttachment(nonce: string) {
        setAttachments((current) => {
            const removed = current.find((item) => item.nonce === nonce);

            if (removed) {
                revokeAttachmentPreview(removed);
            }

            return current.filter((item) => item.nonce !== nonce);
        });
        mentionComposer.focusTextEditor();
    }

    // Clicking inert composer space focuses the editor, which the shell cannot
    // do itself because the mention editor replaces its textarea.
    function handleShellMouseDown(event: React.MouseEvent<HTMLDivElement>) {
        if (isPending) {
            return;
        }

        const target = event.target as HTMLElement;

        if (
            target.closest(
                'button, a, input, select, textarea, [contenteditable], [role="button"], [role="switch"]'
            )
        ) {
            return;
        }

        event.preventDefault();
        mentionComposer.focusTextEditor();
    }
}

function createSelectedAttachment(file: File): SelectedAttachment {
    return {
        file,
        nonce: crypto.randomUUID(),
        ...(file.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(file) } : {}),
    };
}

function revokeAttachmentPreview(attachment: SelectedAttachment) {
    if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
    }
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
