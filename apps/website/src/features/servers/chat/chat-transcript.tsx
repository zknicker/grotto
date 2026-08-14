import type { ChatMessage, ThreadSummary } from '@tavern/api';
import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useAttachmentDownload } from '../../../hooks/servers/use-attachment-download.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { ChatMarkdownText } from '../../chats/chat-markdown-text.tsx';
import { ChatTranscriptPresentation } from '../../chats/chat-transcript.tsx';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type {
    TranscriptMessageRow,
    TranscriptRenderContextValue,
} from '../../chats/chat-transcript-render-context.tsx';
import type { TavernResourceTarget } from '../../chats/tavern-resource-link.ts';
import {
    applyAgentMentionAppearance,
    readMentionsFromMarkdown,
} from '../../mentions/mention-metadata.ts';
import { ArtifactMessage } from './artifact-message.tsx';
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
import type { PendingChatMessage } from './use-pending-messages.ts';

const conversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;
const emptyPendingMessages: readonly PendingChatMessage[] = [];

interface ChatTranscriptInput {
    chatId: string;
    messages: readonly ChatMessage[] | undefined;
    onOpenArtifact: (target: TavernResourceTarget) => void;
    onOpenThread?: (message: ChatMessage, summary: ThreadSummary | null) => void;
    onStartDm?: (userId: string) => void;
    pendingMessages?: readonly PendingChatMessage[];
    serverId: string;
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
    chatId,
    messages,
    onOpenArtifact,
    onOpenThread,
    onStartDm,
    pendingMessages = emptyPendingMessages,
    serverId,
    threads = emptyChatThreads,
    turnDetailsAccess = 'summary',
    viewerUserId,
}: ChatTranscriptInput) {
    const messageList = messages ?? emptyChatMessages;
    const agents = useAgents(serverId);
    const agentList = agents.data ?? emptyChatAgents;
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
                disableAgentHoverCard: true,
                flashMessageId: null,
                turnDetails: {
                    access: turnDetailsAccess,
                    serverId,
                },
                hiddenCount: 0,
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
                renderMessageContent: (message) => {
                    const mentions = applyAgentMentionAppearance(
                        readMentionsFromMarkdown(message.content),
                        (agentId) => {
                            const agent = agentId ? agentsById.get(agentId) : undefined;
                            return {
                                avatarUrl: agent?.avatarUrl ?? null,
                                primaryColor: null,
                            };
                        }
                    );

                    return message.tavernAgentId ? (
                        <ArtifactMessage
                            agentId={message.tavernAgentId}
                            content={message.content}
                            mentions={mentions}
                            onOpenArtifact={onOpenArtifact}
                        />
                    ) : (
                        <ChatMarkdownText content={message.content} mentions={mentions} />
                    );
                },
                repliedRunIds: new Set<string>(),
                resolveActorProfile,
                shouldAnimateItemEnter: () => false,
                threadActionsEnabled: Boolean(onOpenThread),
                turnEvidenceSource: 'embedded',
            }) satisfies TranscriptRenderContextValue,
        [
            agentsById,
            chatId,
            handleOpenThread,
            onOpenThread,
            onOpenArtifact,
            onStartDm,
            onToggleReaction,
            renderMessageAttachments,
            resolveActorProfile,
            serverId,
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
