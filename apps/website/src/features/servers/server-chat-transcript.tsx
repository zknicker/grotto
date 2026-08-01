import type { HostedAgent, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import type { ActorProfile } from '../../hooks/actors/use-actor.ts';
import { useDownloadServerAttachment } from '../../hooks/servers/use-download-server-attachment.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { ChatMarkdownText } from '../chats/chat-markdown-text.tsx';
import { ChatTranscriptPresentation } from '../chats/chat-transcript.tsx';
import type { TranscriptMessage } from '../chats/chat-transcript-message.tsx';
import type { TranscriptActor } from '../chats/chat-transcript-model.ts';
import type {
    TranscriptMessageRow,
    TranscriptRenderContextValue,
} from '../chats/chat-transcript-render-context.tsx';
import type { TavernResourceTarget } from '../chats/tavern-resource-link.ts';
import { HostedArtifactMessage } from './hosted-artifact-message.tsx';
import { HostedMessageAttachments } from './hosted-message-attachments.tsx';

const hostedConversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;

export function ServerChatTranscript({
    activeThreadAnchorId,
    agents,
    chatId,
    composition,
    messages,
    onOpenArtifact,
    onOpenThread,
    onStartDm,
    scrollContentRef,
    threads = [],
}: {
    activeThreadAnchorId?: string;
    agents: HostedAgent[];
    chatId: string;
    composition?: React.ReactNode;
    messages: HostedChatMessage[] | undefined;
    onOpenArtifact: (target: TavernResourceTarget) => void;
    onOpenThread?: (message: HostedChatMessage, summary: HostedThreadSummary | null) => void;
    onStartDm: (userId: string) => void;
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    threads?: HostedThreadSummary[];
}) {
    const download = useDownloadServerAttachment();
    const rows = React.useMemo(
        () => projectHostedChatMessages(messages ?? [], threads, agents),
        [agents, messages, threads]
    );
    const messagesById = React.useMemo(
        () => new Map(messages?.map((message) => [message.id, message]) ?? []),
        [messages]
    );
    const agentsById = React.useMemo(
        () => new Map(agents.map((agent) => [agent.id, agent])),
        [agents]
    );
    const resolveActorProfile = React.useCallback(
        (actor: TranscriptActor): ActorProfile | null => {
            if (!actor) {
                return null;
            }
            if (actor.kind === 'agent') {
                const agent = agentsById.get(actor.id);
                return agent
                    ? {
                          avatarUrl: null,
                          bio: agent.description,
                          character: agent.character,
                          id: agent.id,
                          isSelf: false,
                          kind: 'agent',
                          name: agent.displayName,
                          primaryColor: null,
                      }
                    : null;
            }
            return {
                avatarUrl: null,
                bio: null,
                character: null,
                id: actor.id,
                isSelf: true,
                kind: actor.kind,
                name: 'You',
                primaryColor: '#64748b',
            };
        },
        [agentsById]
    );
    const renderMessageAttachments = React.useCallback(
        (message: TranscriptMessage) => {
            const hostedMessage = messagesById.get(message.id);
            return hostedMessage?.attachments.length ? (
                <HostedMessageAttachments
                    attachments={hostedMessage.attachments}
                    disabled={download.isPending}
                    onDownload={(attachment) =>
                        download.mutate({
                            attachmentId: attachment.id,
                            filename: attachment.filename,
                            serverId: hostedMessage.serverId,
                        })
                    }
                />
            ) : null;
        },
        [download, messagesById]
    );
    const handleOpenThread = React.useCallback(
        (row: TranscriptMessageRow) => {
            const message = messagesById.get(row.message.id);
            if (!message) {
                return;
            }
            const summary =
                threads.find((candidate) => candidate.anchorMessageId === message.id) ?? null;
            onOpenThread?.(message, summary);
        },
        [messagesById, onOpenThread, threads]
    );
    const renderContext = React.useMemo(
        () =>
            ({
                activeThreadAnchorId: activeThreadAnchorId ?? null,
                canRequestMention: true,
                chatId,
                conversationLayout: hostedConversationLayout,
                defaultOpenWorkGroups: false,
                disableAgentHoverCard: true,
                flashMessageId: null,
                hiddenCount: 0,
                onActorClick: (actor) => {
                    if (actor?.kind === 'participant') {
                        onStartDm(actor.id);
                    }
                },
                onOpenThread: handleOpenThread,
                onUnfollowThread: () => undefined,
                profilePaneChatId: chatId,
                renderMessageAttachments,
                renderMessageContent: (message) =>
                    message.tavernAgentId ? (
                        <HostedArtifactMessage
                            agentId={message.tavernAgentId}
                            content={message.content}
                            onOpenArtifact={onOpenArtifact}
                        />
                    ) : (
                        <ChatMarkdownText content={message.content} />
                    ),
                repliedRunIds: new Set<string>(),
                resolveActorProfile,
                shouldAnimateItemEnter: () => false,
                threadActionsEnabled: Boolean(onOpenThread),
                turnEvidenceSource: 'embedded',
            }) satisfies TranscriptRenderContextValue,
        [
            activeThreadAnchorId,
            chatId,
            handleOpenThread,
            onOpenThread,
            onOpenArtifact,
            onStartDm,
            renderMessageAttachments,
            resolveActorProfile,
        ]
    );

    if (!messages) {
        return null;
    }

    return (
        <ChatTranscriptPresentation
            composition={composition}
            leadingContent={
                download.error ? (
                    <p className="px-2 text-destructive text-xs">{download.error.message}</p>
                ) : undefined
            }
            renderContext={renderContext}
            rows={rows}
            scrollContentRef={scrollContentRef}
        />
    );
}

export function projectHostedChatMessages(
    messages: readonly HostedChatMessage[],
    threads: readonly HostedThreadSummary[],
    agents: readonly HostedAgent[] = []
): NonNullable<ChatLogOutput>['rows'] {
    const threadsByAnchor = new Map(threads.map((thread) => [thread.anchorMessageId, thread]));
    const handleByAgentId = new Map(agents.map((agent) => [agent.id, agent.handle]));

    return messages.map((message): NonNullable<ChatLogOutput>['rows'][number] => {
        const actor = hostedMessageActor(message);
        const senderType =
            message.author.kind === 'agent'
                ? ('agent' as const)
                : message.author.kind === 'human'
                  ? ('user' as const)
                  : ('system' as const);
        const agentId = message.author.kind === 'agent' ? message.author.agentId : null;

        return {
            actor,
            connectsToNext: false,
            connectsToPrevious: false,
            id: message.id,
            isFirstInGroup: true,
            kind: 'message',
            message: {
                actor,
                attachments: message.attachments.map((attachment) => ({
                    filename: attachment.filename,
                    mediaType: attachment.mediaType,
                    path: `hosted:${attachment.id}`,
                    sizeBytes: attachment.sizeBytes,
                    type: 'file' as const,
                })),
                content: message.content,
                id: message.id,
                sender:
                    message.author.kind === 'human'
                        ? message.author.userId
                        : message.author.kind === 'agent'
                          ? message.author.agentId
                          : message.author.system === 'reminder'
                            ? 'Reminder'
                            : 'Grotto',
                senderType,
                sourceSessionId: null,
                sourceSessionKey: `hosted:${agentId ?? message.author.kind}`,
                tavernAgentId: agentId,
                task: hostedMessageTask(message.task, handleByAgentId),
                timestamp: message.createdAt,
            },
            responseId: agentId ? message.id : undefined,
            runId: agentId ? `hosted:${message.id}` : null,
            thread: threadsByAnchor.get(message.id) ?? null,
        };
    });
}

function hostedMessageTask(
    task: HostedChatMessage['task'],
    handleByAgentId: ReadonlyMap<string, string>
): TranscriptMessage['task'] {
    if (!task) {
        return null;
    }
    return {
        assignee: hostedTaskAssignee(task, handleByAgentId),
        claimed_at: task.claimedAt,
        created_at: task.createdAt,
        labels: task.labels,
        number: task.number,
        origin: task.origin,
        priority: task.priority,
        status: task.status,
        updated_at: task.updatedAt,
    };
}

function hostedTaskAssignee(
    task: NonNullable<HostedChatMessage['task']>,
    handleByAgentId: ReadonlyMap<string, string>
): { handle: string | null; id: string; kind: 'agent' | 'human' } | null {
    if (task.assigneeAgentId) {
        return {
            handle: handleByAgentId.get(task.assigneeAgentId) ?? null,
            id: task.assigneeAgentId,
            kind: 'agent',
        };
    }
    if (task.assigneeUserId) {
        return { handle: null, id: task.assigneeUserId, kind: 'human' };
    }
    return null;
}

function hostedMessageActor(message: HostedChatMessage): TranscriptActor {
    if (message.author.kind === 'agent') {
        return { id: message.author.agentId, kind: 'agent' };
    }
    if (message.author.kind === 'human') {
        return { id: message.author.userId, kind: 'participant' };
    }
    return null;
}
