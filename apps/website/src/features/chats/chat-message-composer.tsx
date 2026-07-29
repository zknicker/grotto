import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
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
import { Checkbox } from '../../components/ui/checkbox.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import { useChatStop } from '../../hooks/chats/use-chat-stop.ts';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
import { setThreadPaneChatId } from '../../hooks/threads/use-thread-pane.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
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
    const [asTask, setAsTask] = React.useState(false);
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
        onSubmitAsTask: threadTarget
            ? undefined
            : () => {
                  void handleSubmit(undefined, true);
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

    async function handleSubmit(event?: React.FormEvent<HTMLFormElement>, forceAsTask = false) {
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
            ...(!threadTarget && (forceAsTask || asTask) ? { asTask: true } : {}),
            ...(threadTarget ? { thread: threadTarget } : {}),
        });
        if (!threadTarget) {
            setAsTask(false);
        }

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

    return (
        <PromptInput
            className={cn(
                isCompact
                    ? 'border-t border-r-[3px] border-r-border-subtle bg-chrome px-3 py-3'
                    : // Match the transcript's gutter so the composer stays
                      // aligned with the messages.
                      'px-5'
            )}
            contentClassName="max-w-none"
            error={attachmentError ?? sendMessage.error?.message}
            onDragEnter={useMainDropTarget ? undefined : attachmentDrop.onDragEnter}
            onDragLeave={useMainDropTarget ? undefined : attachmentDrop.onDragLeave}
            onDragOver={useMainDropTarget ? undefined : attachmentDrop.onDragOver}
            onDrop={useMainDropTarget ? undefined : attachmentDrop.onDrop}
            onSubmit={handleSubmit}
            onTextEditorFocus={isComposerBlocked ? undefined : mentionComposer.focusTextEditor}
            surfaceClassName={cn(
                isCompact ? 'rounded-xl shadow-none' : undefined,
                isCompact &&
                    attachmentDrop.isFileDropActive &&
                    'border-ring bg-accent ring-2 ring-ring',
                isComposerBlocked && 'cursor-not-allowed opacity-60'
            )}
        >
            <ChatComposerMainDropOverlay
                active={useMainDropTarget && attachmentDrop.isFileDropActive}
            />
            <ChatComposerAttachmentList
                attachments={attachments}
                onRemove={(index) => {
                    setAttachments((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index)
                    );
                    setAttachmentError(null);
                }}
            />
            <PromptInputBody>
                <MentionComposerEditor
                    ariaLabel="Chat message"
                    autoFocus={variant === 'detail'}
                    composer={mentionComposer}
                    disabled={isComposerBlocked || !canSendToRuntime}
                    name="chat-message"
                    placeholder={placeholder}
                />
            </PromptInputBody>
            <MentionComposerPicker composer={mentionComposer} />
            <PromptInputFooter>
                <PromptInputTools>
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
                        disabled={isComposerBlocked || !canSendToRuntime}
                        onClick={() => fileInputRef.current?.click()}
                    />
                </PromptInputTools>
                <PromptInputActions>
                    {threadTarget ? null : (
                        <label className="mr-1 inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                            <Checkbox
                                aria-label="Send as task (⌘/Ctrl-Shift-Enter)"
                                checked={asTask}
                                onCheckedChange={(checked) => setAsTask(checked === true)}
                            />
                            As Task
                        </label>
                    )}
                    {contextFullness ? (
                        <ChatComposerContextFullness fullness={contextFullness} />
                    ) : null}
                    {primaryAction === 'stop' && activeRunIds.length > 0 ? (
                        <PromptInputButton
                            aria-label={stopTurn.isPending ? 'Stopping response' : 'Stop response'}
                            disabled={stopTurn.isPending}
                            onClick={stopActiveRuns}
                            size="icon-tight"
                            tooltip={stopTurn.isPending ? 'Stopping response' : 'Stop response'}
                            type="button"
                        >
                            {stopTurn.isPending ? (
                                <Spinner className="size-4 text-muted-foreground" />
                            ) : (
                                <Icon className="size-5" icon={StopIcon} />
                            )}
                        </PromptInputButton>
                    ) : (
                        <PromptInputSubmit
                            canSubmit={canSubmit}
                            label="Send message"
                            tooltip={getSendDisabledTooltip({
                                agentRuntimeSyncLabel,
                                boundAgentCount: boundAgentIds.length,
                                blockReason,
                                canSend: chatCanSend,
                                isDisabled,
                                isPending: sendMessage.isPending,
                                runtimeReady: canSendToRuntime,
                                runtimeReason: runtimeDisabledReason,
                            })}
                        />
                    )}
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
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
