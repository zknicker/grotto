import { Attachment01Icon, Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useChatComposerFocusRequest } from '../../commands/chat-composer-focus.ts';
import {
    appendComposerInsert,
    useChatComposerInsertRequest,
} from '../../commands/chat-composer-insert.ts';
import { useChatComposerMentionRequest } from '../../commands/chat-composer-mention.ts';
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentGroup,
    AttachmentTitle,
} from '../../components/ui/attachment.tsx';
import { Checkbox } from '../../components/ui/checkbox.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputHeader,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
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

    return (
        <div className="shrink-0 px-5 pb-4">
            {composition.compositions.length > 0 ? (
                <p className="mx-auto mb-1 w-full max-w-[60rem] px-9 text-muted-foreground text-xs">
                    Someone is typing…
                </p>
            ) : null}
            <PromptInput
                className="mx-auto w-full max-w-none"
                error={
                    attachmentError ??
                    upload.error?.message ??
                    createTask.error?.message ??
                    send.error?.message
                }
                onSubmit={handleSubmit}
                onTextEditorFocus={mentionComposer.focusTextEditor}
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
                    <MentionComposerEditor
                        ariaLabel={`Message ${chatName}`}
                        autoFocus={!thread}
                        composer={mentionComposer}
                        disabled={isPending}
                        name="chat-message"
                        placeholder={placeholder ?? `Message ${chatName}`}
                    />
                </PromptInputBody>
                <MentionComposerPicker composer={mentionComposer} />
                <PromptInputFooter>
                    <PromptInputTools>
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
                            </>
                        )}
                    </PromptInputTools>
                    <PromptInputActions>
                        {thread ? null : (
                            <label className="mr-1 inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                                <Checkbox
                                    aria-label="Send as task"
                                    checked={asTask}
                                    onCheckedChange={(checked) => setAsTask(checked === true)}
                                />
                                As Task
                            </label>
                        )}
                        <PromptInputSubmit
                            canSubmit={
                                draft.trim().length > 0 || (!asTask && attachments.length > 0)
                            }
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
