import { ChatMessage } from '@heroui-pro/react';
import { Attachment01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { Agent, AttachmentMetadata } from '@tavern/api';
import {
    Attachment,
    AttachmentContent,
    AttachmentGroup,
    AttachmentMedia,
    AttachmentTitle,
} from '../../../components/chats/attachment.tsx';
import { getEntityInitials } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { ChatMarkdownText } from '../../chats/chat-markdown-text.tsx';
import {
    applyAgentMentionAppearance,
    readMentionsFromMarkdown,
} from '../../mentions/mention-metadata.ts';
import type { PendingChatMessage } from './use-pending-messages.ts';

export function PendingChatMessages({
    messages,
    serverId,
    viewerUserId,
}: {
    messages: readonly PendingChatMessage[];
    serverId: string;
    viewerUserId: string;
}) {
    const agents = useAgents(serverId);
    const humans = useHumanDirectory(serverId);

    return (
        <PendingChatMessageRows
            agents={agents.data ?? []}
            authorAvatarUrl={humans.avatarUrl(viewerUserId)}
            authorName={humans.name(viewerUserId)}
            messages={messages}
        />
    );
}

/**
 * The sender's own message, shown the instant they send it and retired when
 * its durable row arrives. Muted so it reads as in flight rather than as
 * history, and never written into the chat's message cache.
 */
export function PendingChatMessageRows({
    agents,
    authorAvatarUrl,
    authorName,
    messages,
}: {
    agents: readonly Agent[];
    authorAvatarUrl: null | string;
    authorName: string;
    messages: readonly PendingChatMessage[];
}) {
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

    return messages.map((message) => (
        <ChatMessage.Assistant
            className="opacity-70"
            data-slot="pending-chat-message"
            key={message.nonce}
        >
            <ChatMessage.Avatar
                alt={`${authorName} avatar`}
                fallback={getEntityInitials(authorName)}
                src={authorAvatarUrl ?? undefined}
            />
            <ChatMessage.Body>
                <span className="font-semibold text-foreground text-sm leading-5">
                    {authorName}
                </span>
                <ChatMessage.Content>
                    <ChatMarkdownText
                        content={message.content}
                        mentions={applyAgentMentionAppearance(
                            readMentionsFromMarkdown(message.content),
                            (agentId) => ({
                                avatarUrl:
                                    (agentId ? agentsById.get(agentId) : undefined)?.avatarUrl ??
                                    null,
                                primaryColor: null,
                            })
                        )}
                    />
                </ChatMessage.Content>
                <PendingAttachments attachments={message.attachments} />
            </ChatMessage.Body>
        </ChatMessage.Assistant>
    ));
}

// Named, not downloadable: the bytes are still on their way up, so the pending
// row carries no download action for the durable row's to collide with.
function PendingAttachments({ attachments }: { attachments: readonly AttachmentMetadata[] }) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <AttachmentGroup>
            {attachments.map((attachment) => (
                <Attachment key={attachment.id} size="sm">
                    <AttachmentMedia>
                        <Icon icon={Attachment01Icon} />
                    </AttachmentMedia>
                    <AttachmentContent>
                        <AttachmentTitle>{attachment.filename}</AttachmentTitle>
                    </AttachmentContent>
                </Attachment>
            ))}
        </AttachmentGroup>
    );
}
