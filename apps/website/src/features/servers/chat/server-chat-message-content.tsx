import type { Agent, Chat } from '@grotto/api';
import type { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { ChatMarkdownText } from '../../chats/chat-markdown-text.tsx';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type { GrottoResourceTarget } from '../../chats/grotto-resource-link.ts';
import { PreparedActionCard } from '../../chats/prepared-action-card.tsx';
import {
    applyAgentMentionAppearance,
    applyChatMentionAppearance,
    applyHumanMentionAppearance,
    readMentionsFromMarkdown,
} from '../../mentions/mention-metadata.ts';
import type { ReferenceActivation } from '../../mentions/mention-types.ts';
import { ArtifactMessage } from './artifact-message.tsx';

type HumanDirectory = ReturnType<typeof useHumanDirectory>;

export function ServerChatMessageContent({
    agentList,
    agentsById,
    canManage,
    chatsById,
    humans,
    message,
    onOpenArtifact,
    onReferenceActivate,
    serverId,
}: {
    agentList: readonly Agent[];
    agentsById: ReadonlyMap<string, Agent>;
    canManage: boolean;
    chatsById: ReadonlyMap<string, Chat>;
    humans: HumanDirectory;
    message: TranscriptMessage;
    onOpenArtifact: (target: GrottoResourceTarget) => void;
    onReferenceActivate?: ReferenceActivation;
    serverId: string;
}) {
    if (message.preparedAction) {
        const proposer = message.grottoAgentId ? agentsById.get(message.grottoAgentId) : undefined;
        return (
            <PreparedActionCard
                action={message.preparedAction}
                agents={agentList}
                canManage={canManage}
                executedByDisplayName={
                    message.preparedAction.executedByUserId
                        ? humans.name(message.preparedAction.executedByUserId)
                        : undefined
                }
                proposer={{
                    avatarUrl: proposer?.avatarUrl ?? null,
                    displayName: message.sender,
                }}
                serverId={serverId}
            />
        );
    }

    const mentions = applyHumanMentionAppearance(
        applyChatMentionAppearance(
            applyAgentMentionAppearance(readMentionsFromMarkdown(message.content), (agentId) => {
                const agent = agentId ? agentsById.get(agentId) : undefined;
                return {
                    avatarUrl: agent?.avatarUrl ?? null,
                    displayName: agent?.displayName ?? null,
                    primaryColor: null,
                };
            }),
            (chatId) => {
                const chat = chatId ? chatsById.get(chatId) : undefined;
                return { color: chat?.color ?? null, icon: chat?.icon ?? null };
            }
        ),
        (userId) => ({
            avatarUrl: humans.avatarUrl(userId ?? null),
            displayName: humans.member(userId ?? null) ? humans.name(userId ?? null) : null,
        })
    );

    return message.grottoAgentId ? (
        <ArtifactMessage
            agentId={message.grottoAgentId}
            content={message.content}
            mentions={mentions}
            onOpenArtifact={onOpenArtifact}
            onReferenceActivate={onReferenceActivate}
        />
    ) : (
        <ChatMarkdownText
            content={message.content}
            mentions={mentions}
            onReferenceActivate={onReferenceActivate}
        />
    );
}
