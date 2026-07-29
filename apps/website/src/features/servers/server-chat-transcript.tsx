import { Attachment01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import type {
    HostedAgent,
    HostedAttachmentMetadata,
    HostedChatMessage,
    HostedThreadSummary,
} from '@tavern/api';
import * as React from 'react';
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentGroup,
    AttachmentMedia,
    AttachmentTitle,
} from '../../components/ui/attachment.tsx';
import { Icon } from '../../components/ui/icon.tsx';
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

const hostedConversationLayout = {
    showAgentIdentity: true,
    showHumanIdentity: true,
} as const;

export function ServerChatTranscript({
    activeThreadAnchorId,
    agents,
    chatId,
    messages,
    onOpenThread,
    onStartDm,
    scrollContentRef,
    threads = [],
}: {
    activeThreadAnchorId?: string;
    agents: HostedAgent[];
    chatId: string;
    messages: HostedChatMessage[] | undefined;
    onOpenThread?: (message: HostedChatMessage, summary: HostedThreadSummary | null) => void;
    onStartDm: (userId: string) => void;
    scrollContentRef?: React.RefObject<HTMLDivElement | null>;
    threads?: HostedThreadSummary[];
}) {
    const download = useDownloadServerAttachment();
    const rows = React.useMemo(
        () => projectHostedChatMessages(messages ?? [], threads),
        [messages, threads]
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
                renderMessageContent: (message) => <ChatMarkdownText content={message.content} />,
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
    threads: readonly HostedThreadSummary[]
): NonNullable<ChatLogOutput>['rows'] {
    const threadsByAnchor = new Map(threads.map((thread) => [thread.anchorMessageId, thread]));

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
                timestamp: message.createdAt,
            },
            responseId: agentId ? message.id : undefined,
            runId: agentId ? `hosted:${message.id}` : null,
            thread: threadsByAnchor.get(message.id) ?? null,
        };
    });
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

function HostedMessageAttachments({
    attachments,
    disabled,
    onDownload,
}: {
    attachments: HostedAttachmentMetadata[];
    disabled: boolean;
    onDownload: (attachment: HostedAttachmentMetadata) => void;
}) {
    return (
        <AttachmentGroup>
            {attachments.map((attachment) => (
                <Attachment key={attachment.id} size="sm">
                    <AttachmentMedia>
                        <Icon icon={Attachment01Icon} />
                    </AttachmentMedia>
                    <AttachmentContent>
                        <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                        <AttachmentDescription>
                            {attachment.mediaType} · {formatBytes(attachment.sizeBytes)}
                        </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                        <AttachmentAction
                            aria-label={`Download ${attachment.filename}`}
                            disabled={disabled}
                            onClick={() => onDownload(attachment)}
                        >
                            <Icon className="size-3.5" icon={Download04Icon} />
                        </AttachmentAction>
                    </AttachmentActions>
                </Attachment>
            ))}
        </AttachmentGroup>
    );
}

function formatBytes(sizeBytes: number) {
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }
    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
