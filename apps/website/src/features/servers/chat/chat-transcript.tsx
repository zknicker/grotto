import type { ChatMessage, ThreadSummary } from '@grotto/api';
import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useAttachmentDownload } from '../../../hooks/servers/use-attachment-download.ts';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { ChatTranscriptPresentation } from '../../chats/chat-transcript.tsx';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type {
    TranscriptMessageRow,
    TranscriptRenderContextValue,
} from '../../chats/chat-transcript-render-context.tsx';
import type { GrottoResourceTarget } from '../../chats/grotto-resource-link.ts';
import {
    PreparedActionCard,
    preparedActionMessageText,
} from '../../chats/prepared-action-card.tsx';
import { deriveSessionMarks } from '../../chats/session/session-mark-model.ts';
import type { ReferenceActivation } from '../../mentions/mention-types.ts';
import { useResolveActorProfile } from './chat-actor-profiles.ts';
import { applyLocalReactions, useLocalChatReactions } from './chat-local-reactions.ts';
import {
    emptyChatAgents,
    emptyChatMessages,
    emptyChatThreads,
    useStableChatMessageRows,
} from './chat-message-projection.ts';
import { MessageAttachments } from './message-attachments.tsx';
import { PendingMessageAttachments, projectPendingChatMessageRows } from './pending-messages.tsx';
import { ServerChatMessageContent } from './server-chat-message-content.tsx';
import type { PendingChatMessage } from './use-pending-messages.ts';

const conversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;
const emptyPendingMessages: readonly PendingChatMessage[] = [];

interface ChatTranscriptInput {
    canManage?: boolean;
    /** Hides the header automation mark when a context card already states it. */
    causeMarkHidden?: boolean;
    chatId: string;
    messages: readonly ChatMessage[] | undefined;
    onOpenArtifact: (target: GrottoResourceTarget) => void;
    onOpenThread?: (message: ChatMessage, summary: ThreadSummary | null) => void;
    onReferenceActivate?: ReferenceActivation;
    onStartDm?: (userId: string) => void;
    pendingMessages?: readonly PendingChatMessage[];
    serverId: string;
    /** Hides the header task mark when a metadata panel already states it. */
    taskMarkHidden?: boolean;
    threads?: readonly ThreadSummary[];
    turnDetailsAccess?: 'journal' | 'summary';
    viewerUserId?: string;
}

export function ChatTranscript({
    composition,
    scrollContentRef,
    ...input
}: ChatTranscriptInput & {
    composition?: React.ReactNode;
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const { downloadError, renderContext, rows } = useChatTranscript(input);

    if (!input.messages) {
        return null;
    }

    return (
        <ChatTranscriptPresentation
            composition={composition}
            leadingContent={
                downloadError ? (
                    <p className="px-2 text-danger text-sm">{downloadError}</p>
                ) : undefined
            }
            renderContext={renderContext}
            rows={rows}
            scrollContentRef={scrollContentRef}
        />
    );
}

/**
 * Shared Server Chat transcript wiring: projects messages into
 * transcript rows and builds the render context the shared turn
 * presentation needs. The thread panel reuses this so replies render with
 * exactly the same rows as the main chat.
 *
 * Both the rows and the render context hold their identity across a refetch
 * that changed nothing they render. That is what the transcript's row memo
 * needs: the render context reaches every row through context, so a context
 * value rebuilt on each refetch would re-render the whole transcript no matter
 * how stable the rows were.
 */
export function useChatTranscript({
    canManage = false,
    causeMarkHidden,
    chatId,
    messages,
    onOpenArtifact,
    onReferenceActivate,
    onOpenThread,
    onStartDm,
    pendingMessages = emptyPendingMessages,
    serverId,
    taskMarkHidden,
    threads = emptyChatThreads,
    turnDetailsAccess = 'summary',
    viewerUserId,
}: ChatTranscriptInput) {
    const messageList = messages ?? emptyChatMessages;
    const agents = useAgents(serverId);
    const agentList = agents.data ?? emptyChatAgents;
    const chats = useChats(serverId);
    const download = useAttachmentDownload();
    const humans = useHumanDirectory(serverId);
    const { onToggleReaction, reactions } = useLocalChatReactions();
    const projectedRows = useStableChatMessageRows({
        agents: agentList,
        humans,
        messages: messageList,
        threads,
    });
    const durableRows = React.useMemo(
        () => applyLocalReactions(projectedRows, reactions),
        [projectedRows, reactions]
    );
    const pendingRows = React.useMemo(
        () => (viewerUserId ? projectPendingChatMessageRows(pendingMessages, viewerUserId) : []),
        [pendingMessages, viewerUserId]
    );
    const rows = React.useMemo(
        () => (pendingRows.length === 0 ? durableRows : [...durableRows, ...pendingRows]),
        [durableRows, pendingRows]
    );
    const agentsById = React.useMemo(
        () => new Map(agentList.map((agent) => [agent.id, agent])),
        [agentList]
    );
    // Derived across the whole loaded page, not per row: whether a message
    // opened a new session is a difference from that Agent's previous message,
    // which no single row can see.
    const sessionMarks = React.useMemo(
        () =>
            deriveSessionMarks(
                messageList.map((message) => ({
                    agentId: message.author.kind === 'agent' ? message.author.agentId : null,
                    id: message.id,
                    sessionGeneration: message.sessionGeneration,
                }))
            ),
        [messageList]
    );
    const chatsById = React.useMemo(
        () => new Map((chats.data ?? []).map((chat) => [chat.id, chat])),
        [chats.data]
    );
    // Read through a ref: these lookups answer a click or a row's own render,
    // both of which already happen after the newest snapshot landed. Depending
    // on them directly would rebuild the render context on every refetch.
    const lookupRef = useLatestRef({
        messagesById: React.useMemo(
            () => new Map(messageList.map((message) => [message.id, message])),
            [messageList]
        ),
        pendingById: React.useMemo(
            () => new Map(pendingMessages.map((message) => [`pending:${message.nonce}`, message])),
            [pendingMessages]
        ),
        threads,
    });
    const resolveActorProfile = useResolveActorProfile({
        agentsById,
        humans,
        messages: messageList,
    });
    const downloadAttachment = download.mutate;
    const downloadPending = download.isPending;
    const renderMessageAttachments = React.useCallback(
        (message: TranscriptMessage) => {
            const sourceMessage = lookupRef.current.messagesById.get(message.id);

            const pendingMessage = lookupRef.current.pendingById.get(message.id);

            if (pendingMessage) {
                return <PendingMessageAttachments attachments={pendingMessage.attachments} />;
            }

            return sourceMessage?.attachments.length ? (
                <MessageAttachments
                    attachments={sourceMessage.attachments}
                    disabled={downloadPending}
                    onDownload={(attachment) =>
                        downloadAttachment({
                            attachmentId: attachment.id,
                            filename: attachment.filename,
                            serverId: sourceMessage.serverId,
                        })
                    }
                    serverId={sourceMessage.serverId}
                />
            ) : null;
        },
        [downloadAttachment, downloadPending, lookupRef]
    );
    const handleOpenThread = React.useCallback(
        (row: TranscriptMessageRow) => {
            const message = lookupRef.current.messagesById.get(row.message.id);

            if (!message) {
                return;
            }

            const summary =
                lookupRef.current.threads.find(
                    (candidate) => candidate.anchorMessageId === message.id
                ) ?? null;

            onOpenThread?.(message, summary);
        },
        [lookupRef, onOpenThread]
    );
    const renderContext = React.useMemo(
        () =>
            ({
                canRequestMention: true,
                chatId,
                conversationLayout,
                defaultOpenWorkGroups: false,
                flashMessageId: null,
                turnDetails: {
                    access: turnDetailsAccess,
                    serverId,
                },
                hiddenCount: 0,
                messageCopyText: preparedActionMessageText,
                onActorClick: onStartDm
                    ? (actor) => {
                          if (actor?.kind === 'participant') {
                              onStartDm(actor.id);
                          }
                      }
                    : undefined,
                onOpenThread: handleOpenThread,
                onToggleReaction,
                onUnfollowThread: () => undefined,
                profilePaneChatId: chatId,
                renderMessageAttachments,
                renderMessageBlock: (message) =>
                    message.preparedAction ? (
                        <PreparedActionCard
                            action={message.preparedAction}
                            agents={agentList}
                            canManage={canManage}
                            executedByDisplayName={
                                message.preparedAction.executedByUserId
                                    ? humans.name(message.preparedAction.executedByUserId)
                                    : undefined
                            }
                            serverId={serverId}
                        />
                    ) : null,
                renderMessageContent: (message) => (
                    <ServerChatMessageContent
                        agentsById={agentsById}
                        chatsById={chatsById}
                        humans={humans}
                        message={message}
                        onOpenArtifact={onOpenArtifact}
                        onReferenceActivate={onReferenceActivate}
                    />
                ),
                causeMarkHidden,
                repliedRunIds: new Set<string>(),
                resolveActorProfile,
                sessionMarks,
                shouldAnimateItemEnter: () => false,
                taskMarkHidden,
                threadActionsEnabled: Boolean(onOpenThread),
            }) satisfies TranscriptRenderContextValue,
        [
            agentList,
            agentsById,
            canManage,
            causeMarkHidden,
            chatId,
            chatsById,
            handleOpenThread,
            humans,
            onOpenThread,
            onOpenArtifact,
            onReferenceActivate,
            onStartDm,
            onToggleReaction,
            renderMessageAttachments,
            resolveActorProfile,
            serverId,
            sessionMarks,
            taskMarkHidden,
            turnDetailsAccess,
        ]
    );

    return { downloadError: download.error?.message ?? null, renderContext, rows };
}

function useLatestRef<T>(value: T) {
    const ref = React.useRef(value);

    ref.current = value;

    return ref;
}
