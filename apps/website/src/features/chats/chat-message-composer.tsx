import { Tooltip } from '@heroui/react';
import { PromptInput } from '@heroui-pro/react';
import * as React from 'react';
import {
    requestChatComposerFocus,
    useChatComposerFocusRequest,
} from '../../commands/chat-composer-focus.ts';
import {
    appendComposerInsert,
    useChatComposerInsertRequest,
} from '../../commands/chat-composer-insert.ts';
import { useChatComposerMentionRequest } from '../../commands/chat-composer-mention.ts';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import { useChatStop } from '../../hooks/chats/use-chat-stop.ts';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
import { setThreadPaneChatId } from '../../hooks/threads/use-thread-pane.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { compileMentionSubmission, normalizeMentions } from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useMentionComposer,
} from '../mentions/use-mention-composer.tsx';
import { buildAgentMentionOption } from '../mentions/use-mention-options.ts';
import {
    ChatComposerAttachmentList,
    readComposerAttachment,
} from './chat-composer-attachments.tsx';
import { useChatComposerDraftState } from './chat-composer-draft-state.ts';
import { useComposerFileDrop } from './chat-composer-file-drop.ts';
import { ChatComposerMainDropOverlay } from './chat-composer-main-drop-overlay.tsx';
import {
    ChatComposerAttachmentButton,
    ChatComposerContextFullness,
} from './chat-composer-tools.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

export type ChatMessageComposerVariant = 'compact' | 'detail';
const CHAT_COMPOSER_PLACEHOLDER = "Let's go on an adventure...";

export function ChatMessageComposer({
    agentRuntimeSyncLabel = null,
    activeRunIds = [],
    agents,
    blockReason = null,
    boundAgentIds,
    canSend: chatCanSend,
    chatId,
    conversationKind,
    contextFullness = null,
    isDisabled,
    isReplyActive,
    placeholder = CHAT_COMPOSER_PLACEHOLDER,
    stopChatId,
    threadTarget,
    variant = 'detail',
}: {
    agentRuntimeSyncLabel?: string | null;
    activeRunIds?: readonly string[];
    agents: AgentListOutput['agents'];
    blockReason?: string | null;
    boundAgentIds: string[];
    canSend: boolean;
    chatId: string;
    conversationKind: string;
    contextFullness?: ChatContextFullness | null;
    isDisabled: boolean;
    isReplyActive: boolean;
    placeholder?: string;
    // Thread turns run in the thread chat while sends address the parent;
    // stop must target the chat that owns the run.
    stopChatId?: string;
    threadTarget?: { anchorMessageId: string };
    variant?: ChatMessageComposerVariant;
}) {
    const sendMessage = useChatSend();
    const stopTurn = useChatStop();
    const gatewayCapability = useCapability('gateway');
    const draftKey = threadTarget ? `${chatId}:thread:${threadTarget.anchorMessageId}` : chatId;
    const composerDraft = useChatComposerDraftState({ boundAgentIds, chatId: draftKey });
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const { agentId, attachments, content, mentions } = composerDraft.draft;
    const { setAttachments, setContent, setMentions } = composerDraft;
    const isCompact = variant === 'compact';
    const isAgentDm = conversationKind === 'direct';
    // Task sends address one agent explicitly (specs/addressing.md), so task
    // chats carry the bound agent target exactly like DMs do.
    const needsAgentTarget = isAgentDm || conversationKind === 'task';
    const trimmedContent = content.trim();
    const hasPayload = trimmedContent.length > 0 || attachments.length > 0;
    const canSendToRuntime = gatewayCapability.healthy;
    const runtimeDisabledReason = runtimeUnhealthyTooltip;
    const isComposerBlocked = isDisabled || blockReason !== null;
    // Sending while a turn is live is a normal send: the message is durable
    // and Runtime handles mid-turn delivery. Only an in-flight send blocks.
    const canSubmit =
        chatCanSend &&
        canSendToRuntime &&
        !isComposerBlocked &&
        (!needsAgentTarget || agentId.length > 0) &&
        hasPayload &&
        !sendMessage.isPending;
    const primaryAction = getComposerPrimaryAction({
        hasActiveRun: activeRunIds.length > 0,
        hasDraftPayload: hasPayload,
        isReplyActive,
    });
    // Thread composers coexist with the parent's composer; only one may own
    // the app-shell drop target or a drop lands in both drafts.
    const useMainDropTarget = !(isCompact || threadTarget);
    const attachmentDrop = useComposerFileDrop({
        disabled: isComposerBlocked || !canSendToRuntime,
        onFiles: addSelectedAttachments,
        target: useMainDropTarget ? 'main' : 'self',
    });

    const mentionComposer = useMentionComposer({
        agentId,
        agents,
        content,
        mentionableAgentIds: boundAgentIds,
        onTextChange: setContent,
        onSubmit: () => {
            void handleSubmit();
        },
        onMentionsChange: setMentions,
    });
    const focusTextEditorRef = React.useRef(mentionComposer.focusTextEditor);
    focusTextEditorRef.current = mentionComposer.focusTextEditor;
    const canAutoFocusComposer = variant === 'detail' && !isComposerBlocked && canSendToRuntime;
    const chatAutoFocusKey = canAutoFocusComposer ? draftKey : null;

    React.useEffect(() => {
        if (!chatAutoFocusKey) {
            return;
        }

        const frame = requestAnimationFrame(() => focusTextEditorRef.current());
        return () => cancelAnimationFrame(frame);
    }, [chatAutoFocusKey]);

    useChatComposerFocusRequest(
        canAutoFocusComposer && !threadTarget,
        mentionComposer.focusTextEditor
    );
    const handleComposerInsert = React.useCallback(
        (text: string) => {
            setContent((current) => appendComposerInsert(current, text));
            requestAnimationFrame(() => focusTextEditorRef.current());
        },
        [setContent]
    );
    useChatComposerInsertRequest(canAutoFocusComposer && !threadTarget, handleComposerInsert);
    const handleComposerMention = React.useCallback(
        ({ agentId: mentionedAgentId }: { agentId: string }) => {
            // Historical turns keep their author clickable after the agent
            // leaves the chat; the server rejects mentions of unbound agents,
            // so the request is dropped here instead.
            if (!boundAgentIds.includes(mentionedAgentId)) {
                return;
            }
            mentionComposer.handleMentionSelect(
                buildAgentMentionOption({ agentId: mentionedAgentId, agents })
            );
            if (!threadTarget) {
                requestChatComposerFocus();
            }
        },
        [agents, boundAgentIds, mentionComposer.handleMentionSelect, threadTarget]
    );
    useChatComposerMentionRequest(canAutoFocusComposer ? draftKey : null, handleComposerMention);

    async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        if (!canSubmit) {
            return;
        }

        const submission = buildChatComposerSubmission({ content, mentions });
        const submittedAttachments = attachments;
        setContent('');
        setMentions([]);
        setAttachments([]);
        setAttachmentError(null);

        const result = await sendMessage.mutateAsync({
            ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
            chatId,
            clientMessageId: `msg_${crypto.randomUUID()}`,
            content: submission.content,
            ...(threadTarget ? { thread: threadTarget } : {}),
        });

        if (threadTarget && result.threadChatId) {
            setThreadPaneChatId(chatId, threadTarget.anchorMessageId, result.threadChatId);
        }
    }

    function stopActiveRuns() {
        for (const runId of activeRunIds) {
            stopTurn.mutate({ chatId: stopChatId ?? chatId, runId });
        }
    }

    async function handleAttachmentInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const files = [...(event.currentTarget.files ?? [])];
        event.currentTarget.value = '';

        if (files.length === 0) {
            return;
        }

        await addSelectedAttachments(files);
    }

    async function addSelectedAttachments(files: File[]) {
        try {
            setAttachmentError(null);
            const nextAttachments = await Promise.all(files.map(readComposerAttachment));
            setAttachments((current) => [...current, ...nextAttachments]);
        } catch (error) {
            setAttachmentError(
                error instanceof Error ? error.message : 'Could not read attachments.'
            );
        }
    }

    const isEditorDisabled = isComposerBlocked || !canSendToRuntime;
    const isStopAction = primaryAction === 'stop' && activeRunIds.length > 0;
    const sendDisabledTooltip = getSendDisabledTooltip({
        agentRuntimeSyncLabel,
        boundAgentCount: boundAgentIds.length,
        blockReason,
        canSend: chatCanSend,
        isDisabled,
        isPending: sendMessage.isPending,
        runtimeReady: canSendToRuntime,
        runtimeReason: runtimeDisabledReason,
    });
    const errorMessage = attachmentError ?? sendMessage.error?.message;

    return (
        // Match the transcript gutter so the composer stays aligned with the
        // messages; the compact variant hugs its narrower pane.
        <div className={isCompact ? 'px-3 pb-3' : 'px-5 pb-4'}>
            <ChatComposerMainDropOverlay
                active={useMainDropTarget && attachmentDrop.isFileDropActive}
            />
            <PromptInput
                isDisabled={isComposerBlocked}
                // Sending mid-turn is normal here, so the run state must not
                // lock the editor or the toolbar actions.
                lockInputOnRun={false}
                // The stop control is the same send button in its run state.
                onStop={stopActiveRuns}
                onSubmit={() => {
                    void handleSubmit();
                }}
                size={isCompact ? 'sm' : 'md'}
                status={isStopAction ? 'streaming' : 'ready'}
                value={content}
            >
                <PromptInput.Shell
                    data-dragging={
                        !useMainDropTarget && attachmentDrop.isFileDropActive ? 'true' : undefined
                    }
                    onDragEnter={useMainDropTarget ? undefined : attachmentDrop.onDragEnter}
                    onDragLeave={useMainDropTarget ? undefined : attachmentDrop.onDragLeave}
                    onDragOver={useMainDropTarget ? undefined : attachmentDrop.onDragOver}
                    onDrop={useMainDropTarget ? undefined : attachmentDrop.onDrop}
                    onMouseDown={handleShellMouseDown}
                >
                    <PromptInput.Content>
                        {attachments.length > 0 ? (
                            <PromptInput.Attachments>
                                <ChatComposerAttachmentList
                                    attachments={attachments}
                                    onRemove={removeAttachment}
                                />
                            </PromptInput.Attachments>
                        ) : null}
                        {/* Stands in for PromptInput.TextArea: the mention
                            editor keeps its own text styling, and the reserved
                            block below it clears the absolutely placed toolbar. */}
                        <div className={isCompact ? 'mb-10 min-h-12' : 'mb-14 min-h-14'}>
                            <MentionComposerEditor
                                ariaLabel="Chat message"
                                autoFocus={variant === 'detail'}
                                composer={mentionComposer}
                                disabled={isEditorDisabled}
                                name="chat-message"
                                placeholder={placeholder}
                            />
                        </div>
                    </PromptInput.Content>
                    <PromptInput.Toolbar>
                        <PromptInput.ToolbarStart>
                            <input
                                className="sr-only"
                                multiple
                                onChange={(event) => {
                                    void handleAttachmentInputChange(event);
                                }}
                                ref={fileInputRef}
                                type="file"
                            />
                            <ChatComposerAttachmentButton
                                isDisabled={isEditorDisabled}
                                onPress={() => fileInputRef.current?.click()}
                            />
                        </PromptInput.ToolbarStart>
                        <PromptInput.ToolbarEnd>
                            {contextFullness ? (
                                <ChatComposerContextFullness fullness={contextFullness} />
                            ) : null}
                            {isStopAction ? (
                                <Tooltip delay={0}>
                                    <Tooltip.Trigger>
                                        <PromptInput.Send
                                            aria-label={
                                                stopTurn.isPending
                                                    ? 'Stopping response'
                                                    : 'Stop response'
                                            }
                                            isDisabled={stopTurn.isPending}
                                            // 'submitted' renders the spinner
                                            // while the stop request is in
                                            // flight.
                                            status={stopTurn.isPending ? 'submitted' : 'streaming'}
                                        />
                                    </Tooltip.Trigger>
                                    <Tooltip.Content>
                                        {stopTurn.isPending ? 'Stopping response' : 'Stop response'}
                                    </Tooltip.Content>
                                </Tooltip>
                            ) : (
                                <SendAction
                                    canSubmit={canSubmit}
                                    disabledTooltip={sendDisabledTooltip}
                                />
                            )}
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

    function removeAttachment(index: number) {
        setAttachments((current) => current.filter((_, entryIndex) => entryIndex !== index));
        setAttachmentError(null);
        mentionComposer.focusTextEditor();
    }

    // Clicking inert composer space focuses the editor, which the shell cannot
    // do itself because the mention editor replaces its textarea.
    function handleShellMouseDown(event: React.MouseEvent<HTMLDivElement>) {
        if (isEditorDisabled) {
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

function SendAction({
    canSubmit,
    disabledTooltip,
}: {
    canSubmit: boolean;
    disabledTooltip?: string;
}) {
    const send = <PromptInput.Send aria-label="Send message" isDisabled={!canSubmit} />;

    if (canSubmit || !disabledTooltip) {
        return send;
    }

    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger>{send}</Tooltip.Trigger>
            <Tooltip.Content>{disabledTooltip}</Tooltip.Content>
        </Tooltip>
    );
}

export function buildChatComposerSubmission({
    content,
    mentions,
}: {
    content: string;
    mentions: Mention[];
}) {
    const leadingTrimLength = content.length - content.trimStart().length;
    const submittedContent = content.trimStart();
    const submittedMentions = normalizeMentions(
        submittedContent,
        mentions.map((mention) => ({
            ...mention,
            end: mention.end - leadingTrimLength,
            start: mention.start - leadingTrimLength,
        }))
    );
    const submission = compileMentionSubmission(submittedContent, submittedMentions);
    return {
        content: submission.content.trim(),
    };
}

export function getComposerPrimaryAction(input: {
    hasActiveRun: boolean;
    hasDraftPayload: boolean;
    isReplyActive: boolean;
}) {
    return input.hasActiveRun && input.isReplyActive && !input.hasDraftPayload ? 'stop' : 'submit';
}

function getSendDisabledTooltip({
    agentRuntimeSyncLabel,
    blockReason,
    boundAgentCount,
    canSend,
    isDisabled,
    isPending,
    runtimeReady,
    runtimeReason,
}: {
    agentRuntimeSyncLabel: string | null;
    blockReason: string | null;
    boundAgentCount: number;
    canSend: boolean;
    isDisabled: boolean;
    isPending: boolean;
    runtimeReady: boolean;
    runtimeReason: string;
}) {
    if (isPending) {
        return 'Sending message...';
    }

    if (blockReason) {
        return blockReason;
    }

    if (boundAgentCount === 0) {
        return 'Bind an agent before sending.';
    }

    if (isDisabled) {
        return agentRuntimeSyncLabel ?? 'Chat is not ready for sending.';
    }

    if (!runtimeReady) {
        return runtimeReason;
    }

    if (!canSend) {
        return 'This chat does not have a synced session for sending.';
    }

    return undefined;
}
