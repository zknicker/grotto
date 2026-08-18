import { PromptInput } from '@heroui-pro/react';
import { Attachment01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { Agent } from '@tavern/api';
import * as React from 'react';
import { useChatComposerFocusRequest } from '../../../commands/chat-composer-focus.ts';
import {
    appendComposerInsert,
    useChatComposerInsertRequest,
} from '../../../commands/chat-composer-insert.ts';
import { useChatComposerMentionRequest } from '../../../commands/chat-composer-mention.ts';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useChatMessageSend } from '../../../hooks/servers/use-chat-message-send.ts';
import { useUploadServerAttachment } from '../../../hooks/servers/use-upload-server-attachment.ts';
import { buildChatComposerSubmission } from '../../chats/chat-composer-submission.ts';
import { buildAgentMentionOption } from '../../mentions/mention-options.ts';
import type { Mention } from '../../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useServerMentionComposer,
} from '../../mentions/use-mention-composer.tsx';
import { ComposerAttachments } from './composer-attachments.tsx';
import { type ComposerAttachment, useComposerAttachments } from './use-composer-attachments.ts';
import {
    addPendingChatMessage,
    dropPendingChatMessage,
    settlePendingChatMessage,
} from './use-pending-messages.ts';

const emptyAgents: Agent[] = [];

export function ChatComposer({
    chatId,
    chatName,
    onThreadCreated,
    pendingChatId,
    placeholder,
    serverId,
    thread,
}: {
    chatId: string;
    chatName: string;
    onThreadCreated?: (threadChatId: string) => void;
    /**
     * The transcript that shows this composer's sends while they are in flight.
     * A chat renders its own id; a Thread renders an anchor-owned key, because
     * a first reply has no Thread chat id until its receipt returns.
     */
    pendingChatId?: string;
    placeholder?: string;
    serverId: string;
    thread?: { anchorMessageId: string };
}) {
    const agents = useAgents(serverId);
    const agentList = agents.data ?? emptyAgents;
    const [draft, setDraft] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const {
        add: addAttachments,
        attachments,
        clear: clearAttachments,
        error: attachmentError,
        inputRef: attachmentInput,
        remove: removeAttachment,
    } = useComposerAttachments();
    // Submitting is synchronous now, so the guard against a second handler
    // firing for the same keystroke has to be too: React has not re-rendered
    // yet, and both would otherwise read the same uncleared draft.
    const submissionRef = React.useRef({ attachments, draft, mentions });
    submissionRef.current = { attachments, draft, mentions };
    const send = useChatMessageSend();
    const upload = useUploadServerAttachment();
    const mentionableAgentIds = React.useMemo(
        () => agentList.map((agent) => agent.id),
        [agentList]
    );
    const mentionComposer = useServerMentionComposer({
        agents: agentList,
        chatId,
        content: draft,
        mentionableAgentIds,
        onMentionsChange: setMentions,
        onSubmit: () => {
            void handleSubmit();
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

    // Sending is optimistic: the draft leaves the editor immediately and the
    // transcript's pending row carries it, so nothing here waits on a round
    // trip. A failed send puts the whole draft back, ready to retry.
    async function handleSubmit(event?: React.FormEvent) {
        event?.preventDefault();
        const submitted = submissionRef.current;
        const { content } = buildChatComposerSubmission({
            content: submitted.draft,
            mentions: submitted.mentions,
        });
        if (content.length === 0 && submitted.attachments.length === 0) {
            return;
        }

        const nonce = crypto.randomUUID();
        submissionRef.current = { attachments: [], draft: '', mentions: [] };
        setDraft('');
        setMentions([]);
        clearAttachments();

        try {
            if (pendingChatId) {
                addPendingChatMessage(pendingChatId, {
                    attachments: submitted.attachments.map(pendingAttachment),
                    content,
                    nonce,
                });
            }
            const uploaded = await Promise.all(
                submitted.attachments.map((attachment) =>
                    upload.mutateAsync({
                        chatId,
                        file: attachment.file,
                        nonce: attachment.nonce,
                        serverId,
                    })
                )
            );
            const receipt = await send.mutateAsync({
                attachmentIds: uploaded.map((attachment) => attachment.id),
                chatId,
                content,
                nonce,
                serverId,
                thread,
            });
            if (pendingChatId) {
                settlePendingChatMessage({
                    chatId: pendingChatId,
                    messageId: receipt.message.id,
                    nonce,
                });
            }
            if (receipt.threadChatId) {
                onThreadCreated?.(receipt.threadChatId);
            }
        } catch {
            // The mutation hooks own the error text below; this restores the
            // draft so the send can be retried without retyping it.
            if (pendingChatId) {
                dropPendingChatMessage(pendingChatId, nonce);
            }
            setDraft(submitted.draft);
            setMentions(submitted.mentions);
            if (submitted.attachments.length > 0) {
                addAttachments(submitted.attachments.map((attachment) => attachment.file));
            }
            mentionComposer.focusTextEditor();
        }
    }

    const errorMessage = attachmentError ?? upload.error?.message ?? send.error?.message;
    const canSubmit = draft.trim().length > 0 || attachments.length > 0;

    return (
        <div className="shrink-0 px-5 pb-4">
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
                                onPress={() => attachmentInput.current?.click()}
                                tooltip="Add attachments"
                            >
                                <Icon className="size-4" icon={Attachment01Icon} />
                            </PromptInput.Action>
                        </PromptInput.ToolbarStart>
                        <PromptInput.ToolbarEnd>
                            <PromptInput.Send aria-label="Send" isDisabled={!canSubmit} />
                        </PromptInput.ToolbarEnd>
                    </PromptInput.Toolbar>
                </PromptInput.Shell>
                {/* The picker opens above the composer, so it sits outside the
                    shell, which clips its overflow. */}
                <MentionComposerPicker composer={mentionComposer} />
            </PromptInput>
            {errorMessage ? <p className="mt-2 text-danger text-sm">{errorMessage}</p> : null}
        </div>
    );

    // Clicking inert composer space focuses the editor, which the shell cannot
    // do itself because the mention editor replaces its textarea.
    function handleShellMouseDown(event: React.MouseEvent<HTMLDivElement>) {
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

// The pending row names the files while their bytes are still uploading, so it
// describes the local File rather than a reserved attachment.
function pendingAttachment(attachment: ComposerAttachment) {
    return {
        filename: attachment.file.name,
        id: attachment.nonce,
        mediaType: attachment.file.type || 'application/octet-stream',
        sizeBytes: attachment.file.size,
    };
}
