import type { ChatMessage, ThreadSummary } from '@grotto/api';
import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useAttachmentDownload } from '../../../hooks/servers/use-attachment-download.ts';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useChatCloudAgentWork } from '../../../hooks/servers/use-cloud-agent-work.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type {
    TranscriptRenderContextValue,
    TranscriptThreadTarget,
} from '../../chats/chat-transcript-render-context.tsx';
import type { GrottoResourceTarget } from '../../chats/grotto-resource-link.ts';
import {
    PreparedActionCard,
    preparedActionMessageText,
} from '../../chats/prepared-action-card.tsx';
import { indexCloudAgentWorkByThreadAnchor } from '../../cloud-agents/hoisted-cloud-agent-work.ts';
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
import { useTranscriptMarks } from './use-transcript-marks.ts';

const conversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;
const emptyPendingMessages: readonly PendingChatMessage[] = [];

export interface ChatTranscriptInput {
    canManage?: boolean;
    /** Hides the header automation mark when a context card already states it. */
    causeMarkHidden?: boolean;
    chatId: string;
    /** The Channel or DM this transcript belongs to; a Thread names its parent. */
    conversationChatId?: string;
    messages: readonly ChatMessage[] | undefined;
    onOpenArtifact: (target: GrottoResourceTarget) => void;
    onOpenThread?: (message: ChatMessage, summary: ThreadSummary | null) => void;
    onReferenceActivate?: ReferenceActivation;
    onStartDm?: (userId: string) => void;
    pendingMessages?: readonly PendingChatMessage[];
    serverId: string;
    /** Hides one Message's task chip when a metadata panel already states it. */
    taskChipHiddenMessageId?: string;
    threads?: readonly ThreadSummary[];
    turnDetailsAccess?: 'journal' | 'summary';
    viewerUserId?: string;
}

/** Rows and render context retain identity across unchanged refetches to avoid rerendering every turn. */
export function useChatTranscript({
    canManage = false,
    causeMarkHidden,
    chatId,
    conversationChatId,
    messages,
    onOpenArtifact,
    onReferenceActivate,
    onOpenThread,
    onStartDm,
    pendingMessages = emptyPendingMessages,
    serverId,
    taskChipHiddenMessageId,
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
    const { handledTaskMarks, sessionMarks } = useTranscriptMarks(messageList);
    // All work delegated inside a Thread, indexed by that Thread's anchor: the
    // transcript surface owns this read, and each row only looks its own
    // Message up. `cloud-agent-work.updated` already invalidates the list.
    const threadCloudAgentWork = useChatCloudAgentWork(serverId, conversationChatId ?? chatId);
    const hoistedCloudAgentWork = React.useMemo(
        () => indexCloudAgentWorkByThreadAnchor(threadCloudAgentWork.data),
        [threadCloudAgentWork.data]
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
        (target: TranscriptThreadTarget) => {
            const message = lookupRef.current.messagesById.get(target.message.id);

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
                conversationChatId: conversationChatId ?? chatId,
                conversationLayout,
                defaultOpenWorkGroups: false,
                flashMessageId: null,
                turnDetails: {
                    access: turnDetailsAccess,
                    serverId,
                },
                hiddenCount: 0,
                hoistedCloudAgentWork,
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
                handledTaskMarks,
                repliedRunIds: new Set<string>(),
                resolveActorProfile,
                sessionMarks,
                shouldAnimateItemEnter: () => false,
                taskChipHiddenMessageId,
                threadActionsEnabled: Boolean(onOpenThread),
            }) satisfies TranscriptRenderContextValue,
        [
            agentList,
            agentsById,
            canManage,
            causeMarkHidden,
            chatId,
            chatsById,
            conversationChatId,
            handledTaskMarks,
            handleOpenThread,
            hoistedCloudAgentWork,
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
            taskChipHiddenMessageId,
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
