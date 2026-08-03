import type { HostedAgent, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import type { ActorProfile } from '../../hooks/actors/use-actor.ts';
import { useDownloadServerAttachment } from '../../hooks/servers/use-download-server-attachment.ts';
import { useHumanDirectory } from '../../hooks/servers/use-human-directory.ts';
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
import type { HumanDirectory } from './human-identity.ts';

const hostedConversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;

interface HostedTranscriptInput {
    activeThreadAnchorId?: string;
    agents: HostedAgent[];
    chatId: string;
    messages: HostedChatMessage[] | undefined;
    onOpenArtifact: (target: TavernResourceTarget) => void;
    onOpenThread?: (message: HostedChatMessage, summary: HostedThreadSummary | null) => void;
    onStartDm?: (userId: string) => void;
    serverId: string;
    threads?: HostedThreadSummary[];
}

export function ServerChatTranscript({
    composition,
    scrollContentRef,
    ...input
}: HostedTranscriptInput & {
    composition?: React.ReactNode;
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
}) {
    const { downloadError, renderContext, rows } = useHostedTranscript(input);

    if (!input.messages) {
        return null;
    }

    return (
        <ChatTranscriptPresentation
            composition={composition}
            leadingContent={
                downloadError ? (
                    <p className="px-2 text-destructive text-xs">{downloadError}</p>
                ) : undefined
            }
            renderContext={renderContext}
            rows={rows}
            scrollContentRef={scrollContentRef}
        />
    );
}

/**
 * Shared hosted-chat transcript wiring: projects hosted messages into
 * transcript rows and builds the render context the shared turn
 * presentation needs. The thread panel reuses this so replies render with
 * exactly the same rows as the main chat.
 */
export function useHostedTranscript({
    activeThreadAnchorId,
    agents,
    chatId,
    messages,
    onOpenArtifact,
    onOpenThread,
    onStartDm,
    serverId,
    threads = [],
}: HostedTranscriptInput) {
    const download = useDownloadServerAttachment();
    const humans = useHumanDirectory(serverId);
    // App-local reactions until the hosted reaction API lands: toggling only
    // updates this in-memory map, so the reaction UI is fully exercisable
    // today and swaps to the server mutation later without UI changes.
    const [localReactions, setLocalReactions] = React.useState<LocalReactionsByMessage>({});
    const onToggleReaction = React.useCallback(
        (input: { emoji: string; messageId: string; remove: boolean }) =>
            setLocalReactions((previous) => toggleLocalReaction(previous, input)),
        []
    );
    const rows = React.useMemo(() => {
        const projected = projectHostedChatMessages(messages ?? [], threads, agents, humans);

        return projected.map((row) =>
            row.kind === 'message' && localReactions[row.id]?.length
                ? { ...row, message: { ...row.message, reactions: localReactions[row.id] } }
                : row
        );
    }, [agents, humans, localReactions, messages, threads]);
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
                          avatarUrl: agent.avatarUrl,
                          bio: agent.description,
                          id: agent.id,
                          isSelf: false,
                          kind: 'agent',
                          name: agent.displayName,
                      }
                    : null;
            }
            const member = humans.member(actor.id);
            return {
                avatarUrl: humans.avatarUrl(actor.id),
                bio: member?.description ?? null,
                id: actor.id,
                isSelf: humans.isSelf(actor.id),
                kind: actor.kind,
                name: humans.name(actor.id),
            };
        },
        [agentsById, humans]
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
            onToggleReaction,
            renderMessageAttachments,
            resolveActorProfile,
        ]
    );

    return { downloadError: download.error?.message ?? null, renderContext, rows };
}

type LocalReactionsByMessage = Record<
    string,
    { actors: { handle: null | string; id: string }[]; emoji: string }[]
>;

const localReactionViewer = { handle: 'you', id: 'usr_tavern' } as const;

function toggleLocalReaction(
    previous: LocalReactionsByMessage,
    input: { emoji: string; messageId: string; remove: boolean }
): LocalReactionsByMessage {
    const current = previous[input.messageId] ?? [];
    const next = input.remove
        ? current
              .map((reaction) =>
                  reaction.emoji === input.emoji
                      ? {
                            ...reaction,
                            actors: reaction.actors.filter(
                                ({ id }) => id !== localReactionViewer.id
                            ),
                        }
                      : reaction
              )
              .filter((reaction) => reaction.actors.length > 0)
        : current.some((reaction) => reaction.emoji === input.emoji)
          ? current.map((reaction) =>
                reaction.emoji === input.emoji &&
                !reaction.actors.some(({ id }) => id === localReactionViewer.id)
                    ? { ...reaction, actors: [...reaction.actors, localReactionViewer] }
                    : reaction
            )
          : [...current, { actors: [localReactionViewer], emoji: input.emoji }];

    return { ...previous, [input.messageId]: next };
}

export function projectHostedChatMessages(
    messages: readonly HostedChatMessage[],
    threads: readonly HostedThreadSummary[],
    agents: readonly HostedAgent[] = [],
    humans?: HumanDirectory
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
                          : 'Reminder',
                senderType,
                sourceSessionId: null,
                sourceSessionKey: `hosted:${agentId ?? message.author.kind}`,
                tavernAgentId: agentId,
                task: hostedMessageTask(message.task, handleByAgentId, humans),
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
    handleByAgentId: ReadonlyMap<string, string>,
    humans?: HumanDirectory
): TranscriptMessage['task'] {
    if (!task) {
        return null;
    }
    return {
        assignee: hostedTaskAssignee(task, handleByAgentId, humans),
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
    handleByAgentId: ReadonlyMap<string, string>,
    humans?: HumanDirectory
): { handle: string | null; id: string; kind: 'agent' | 'human' } | null {
    if (task.assigneeAgentId) {
        return {
            handle: handleByAgentId.get(task.assigneeAgentId) ?? null,
            id: task.assigneeAgentId,
            kind: 'agent',
        };
    }
    if (task.assigneeUserId) {
        return {
            handle: humans?.member(task.assigneeUserId)?.handle ?? null,
            id: task.assigneeUserId,
            kind: 'human',
        };
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
