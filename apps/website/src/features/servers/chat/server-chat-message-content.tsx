import type { Agent, Chat } from '@grotto/api';
import type { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { ChatMarkdownText } from '../../chats/chat-markdown-text.tsx';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type { GrottoResourceTarget } from '../../chats/grotto-resource-link.ts';
import { preparedActionMessageText } from '../../chats/prepared-action-card.tsx';
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
    agentsById,
    chatsById,
    humans,
    message,
    onOpenArtifact,
    onReferenceActivate,
}: {
    agentsById: ReadonlyMap<string, Agent>;
    chatsById: ReadonlyMap<string, Chat>;
    humans: HumanDirectory;
    message: TranscriptMessage;
    onOpenArtifact: (target: GrottoResourceTarget) => void;
    onReferenceActivate?: ReferenceActivation;
}) {
    // The prepared-action card is its own transcript block below this row.
    // Here the anchor renders like any other agent message.
    const content = preparedActionMessageText(message);

    // The Server stores an empty anchor body; with no note either, the card
    // below is the whole row.
    if (message.preparedAction && !content) {
        return null;
    }

    const mentions = applyHumanMentionAppearance(
        applyChatMentionAppearance(
            applyAgentMentionAppearance(readMentionsFromMarkdown(content), (agentId) => {
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
            content={content}
            mentions={mentions}
            onOpenArtifact={onOpenArtifact}
            onReferenceActivate={onReferenceActivate}
        />
    ) : (
        <ChatMarkdownText
            content={content}
            mentions={mentions}
            onReferenceActivate={onReferenceActivate}
        />
    );
}
