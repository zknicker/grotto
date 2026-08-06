import { Switch } from '@heroui/react';
import { PromptInput } from '@heroui-pro/react';
import { Attachment01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { useChatComposerFocusRequest } from '../../../commands/chat-composer-focus.ts';
import {
    appendComposerInsert,
    useChatComposerInsertRequest,
} from '../../../commands/chat-composer-insert.ts';
import { useChatComposerMentionRequest } from '../../../commands/chat-composer-mention.ts';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useChatCompositions } from '../../../hooks/servers/use-chat-compositions.ts';
import { useChatMessageSend } from '../../../hooks/servers/use-chat-message-send.ts';
import { useTaskCreate } from '../../../hooks/servers/use-task-create.ts';
import { useUploadServerAttachment } from '../../../hooks/servers/use-upload-server-attachment.ts';
import { buildChatComposerSubmission } from '../../chats/chat-message-composer.tsx';
import type { Mention } from '../../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useHostedMentionComposer,
} from '../../mentions/use-mention-composer.tsx';
import { buildAgentMentionOption } from '../../mentions/use-mention-options.ts';
import { ComposerAttachments } from './composer-attachments.tsx';
import { useComposerAttachments } from './use-composer-attachments.ts';
import { useCompositionDraft } from './use-composition-draft.ts';

const emptyAgents: HostedAgent[] = [];

export function ChatComposer({
    chatId,
    chatName,
    compositionChatId,
    onThreadCreated,
    placeholder,
    serverId,
    thread,
}: {
    chatId: string;
    chatName: string;
    compositionChatId: string | undefined;
    onThreadCreated?: (threadChatId: string) => void;
    placeholder?: string;
    serverId: string;
    thread?: { anchorMessageId: string };
}) {
    const agents = useAgents(serverId);
    const agentList = agents.data ?? emptyAgents;
    const [draft, setDraft] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [asTask, setAsTask] = React.useState(false);
    const {
        add: addAttachments,
        attachments,
        clear: clearAttachments,
        error: attachmentError,
        inputRef: attachmentInput,
        remove: removeAttachment,
    } = useComposerAttachments();
    const send = useChatMessageSend();
    const createTask = useTaskCreate();
    const upload = useUploadServerAttachment();
    const compositions = useChatCompositions(serverId, compositionChatId);
    const clearComposition = useCompositionDraft({
        chatId: compositionChatId,
        draft,
        serverId,
    });
    const mentionableAgentIds = React.useMemo(
        () => agentList.map((agent) => agent.id),
        [agentList]
    );
    const mentionComposer = useHostedMentionComposer({
        agents: agentList,
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
        const agent = agentList.find((candidate) => candidate.id === agentId);
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
        clearAttachments();
        clearComposition();
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
            {compositions.length > 0 ? (
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
                        <ComposerAttachments
                            attachments={attachments}
                            disabled={isPending}
                            onRemove={(nonce) => {
                                removeAttachment(nonce);
                                mentionComposer.focusTextEditor();
                            }}
                        />
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
                            <input
                                className="sr-only"
                                multiple
                                onChange={(event) => {
                                    const files = Array.from(event.target.files ?? []);
                                    addAttachments(files);
                                }}
                                ref={attachmentInput}
                                type="file"
                            />
                            <PromptInput.Action
                                aria-label="Add attachments"
                                isDisabled={isPending}
                                onPress={() => attachmentInput.current?.click()}
                                tooltip="Add attachments"
                            >
                                <Icon className="size-4" icon={Attachment01Icon} />
                            </PromptInput.Action>
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
