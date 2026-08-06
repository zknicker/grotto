import type { HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import type { ActorProfile } from '../../../hooks/actors/use-actor.ts';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useAttachmentDownload } from '../../../hooks/servers/use-attachment-download.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { ChatMarkdownText } from '../../chats/chat-markdown-text.tsx';
import { ChatTranscriptPresentation } from '../../chats/chat-transcript.tsx';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type { TranscriptActor } from '../../chats/chat-transcript-model.ts';
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
import { projectChatMessages } from './chat-message-model.ts';
import { MessageAttachments } from './message-attachments.tsx';

const conversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;

interface ChatTranscriptInput {
    activeThreadAnchorId?: string;
    chatId: string;
    messages: HostedChatMessage[] | undefined;
    onOpenArtifact: (target: TavernResourceTarget) => void;
    onOpenThread?: (message: HostedChatMessage, summary: HostedThreadSummary | null) => void;
    onStartDm?: (userId: string) => void;
    serverId: string;
    threads?: HostedThreadSummary[];
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
                    <p className="px-2 text-danger text-xs">{downloadError}</p>
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
export function useChatTranscript({
    activeThreadAnchorId,
    chatId,
    messages,
    onOpenArtifact,
    onOpenThread,
    onStartDm,
    serverId,
    threads = [],
}: ChatTranscriptInput) {
    const agents = useAgents(serverId);
    const agentList = agents.data ?? [];
    const download = useAttachmentDownload();
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
        const projected = projectChatMessages(messages ?? [], threads, agentList, humans);

        return projected.map((row) =>
            row.kind === 'message' && localReactions[row.id]?.length
                ? { ...row, message: { ...row.message, reactions: localReactions[row.id] } }
                : row
        );
    }, [agentList, humans, localReactions, messages, threads]);
    const messagesById = React.useMemo(
        () => new Map(messages?.map((message) => [message.id, message]) ?? []),
        [messages]
    );
    const agentsById = React.useMemo(
        () => new Map(agentList.map((agent) => [agent.id, agent])),
        [agentList]
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
            const sourceMessage = messagesById.get(message.id);
            return sourceMessage?.attachments.length ? (
                <MessageAttachments
                    attachments={sourceMessage.attachments}
                    disabled={download.isPending}
                    onDownload={(attachment) =>
                        download.mutate({
                            attachmentId: attachment.id,
                            filename: attachment.filename,
                            serverId: sourceMessage.serverId,
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
                conversationLayout,
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
            activeThreadAnchorId,
            agentsById,
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
