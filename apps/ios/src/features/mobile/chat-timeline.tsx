import { BubbleChatIcon } from '@hugeicons-pro/core-solid-rounded';
import type { HostedChatMessage } from '@tavern/api';
import { useAgents, useChatMessagePages, useChatRead, useMembers } from '@tavern/app-client';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native/pressable-feedback';
import { Spinner } from 'heroui-native/spinner';
import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

import { AgentAvatar } from './agent-avatar';
import { AppIcon } from './app-icon';
import { EntityAvatar } from './entity-avatar';
import { toAgentSummary } from './mobile-data';
import { type PendingMessage, usePendingMessages } from './pending-messages';
import type { ActorSummary, AgentSummary } from './types';

function MessageRow({
    actor,
    content,
    createdAt,
    messageId,
    pending = false,
    replies,
}: {
    actor: ActorSummary;
    content: string;
    createdAt: string;
    messageId: string;
    pending?: boolean;
    replies: number;
}) {
    const router = useRouter();

    return (
        <View className={`flex-row items-start gap-3 px-4 py-1.5 ${pending ? 'opacity-60' : ''}`}>
            <MessageAvatar actor={actor} />
            <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-baseline gap-2">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>
                        {actor.displayName}
                    </Text>
                    <Text className="text-muted text-xs tabular-nums">
                        {formatTimestamp(createdAt)}
                    </Text>
                </View>

                <Text className="text-base text-foreground leading-5">{content}</Text>

                {pending ? (
                    <View className="flex-row items-center gap-1.5">
                        <Spinner size="sm" />
                        <Text className="text-muted text-xs">Sending</Text>
                    </View>
                ) : null}

                {replies > 0 ? (
                    <PressableFeedback
                        accessibilityLabel={`${replies} replies`}
                        accessibilityRole="button"
                        className="min-h-7 flex-row items-center gap-1.5 self-start"
                        hitSlop={10}
                        onPress={() =>
                            router.push({ pathname: '/thread/[id]', params: { id: messageId } })
                        }
                    >
                        <AppIcon icon={BubbleChatIcon} size={16} tone="accent" />
                        <Text className="font-medium text-accent text-sm">{replies} replies</Text>
                    </PressableFeedback>
                ) : null}
            </View>
        </View>
    );
}

function MessageAvatar({ actor }: { actor: ActorSummary }) {
    if (actor.kind === 'agent') {
        return <AgentAvatar agent={actor} size={36} />;
    }

    return <EntityAvatar avatarUrl={actor.avatarUrl} name={actor.displayName} size={36} />;
}

export function ChatTimeline({
    chatId,
    serverId,
}: {
    chatId: string | undefined;
    serverId: string;
}) {
    const messages = useChatMessagePages(serverId, chatId);
    const agents = useAgents(serverId).data?.map(toAgentSummary) ?? [];
    const members = useMembers(serverId).data;
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const viewer = members?.members.find((member) => member.userId === members.viewerUserId);
    const pendingMessages = usePendingMessages(chatId ?? '', messages.messages);
    const timelineMessages = useMemo(
        () =>
            [
                ...messages.messages.map((message) => ({ kind: 'durable' as const, message })),
                ...pendingMessages.map((message) => ({ kind: 'pending' as const, message })),
            ].reverse(),
        [messages.messages, pendingMessages]
    );
    const replyCountByMessage = new Map(
        messages.threads.map((thread) => [thread.anchorMessageId, thread.replyCount])
    );
    useChatRead({
        chatId,
        sequence: messages.messages.at(-1)?.sequence,
        serverId,
    });

    if (!chatId) {
        return (
            <View className="flex-1 items-center justify-center px-8">
                <Text className="text-center text-muted">No chat selected.</Text>
            </View>
        );
    }

    if (messages.isPending && !messages.data) {
        return (
            <View className="flex-1 items-center justify-center">
                <Spinner />
            </View>
        );
    }

    if (messages.isError && !messages.data) {
        return (
            <View className="flex-1 items-center justify-center px-8">
                <Text className="text-center text-muted">Messages are unavailable.</Text>
            </View>
        );
    }

    return (
        <FlatList
            contentContainerClassName="gap-2 py-3"
            data={timelineMessages}
            initialNumToRender={10}
            inverted
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) =>
                item.kind === 'durable' ? item.message.id : `pending:${item.message.nonce}`
            }
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            maxToRenderPerBatch={8}
            onEndReached={() => {
                if (messages.hasOlderHistory && !messages.isFetchingOlderHistory) {
                    void messages.fetchOlderHistory();
                }
            }}
            onEndReachedThreshold={0.3}
            renderItem={({ item }) => {
                if (item.kind === 'pending') {
                    return (
                        <PendingMessageRow
                            message={item.message}
                            viewer={{
                                avatarUrl: viewer?.avatarUrl ?? null,
                                displayName: viewer?.displayName ?? 'You',
                                id: members?.viewerUserId ?? 'viewer',
                                kind: 'human',
                            }}
                        />
                    );
                }
                if (item.message.author.kind === 'system') {
                    return (
                        <View className="items-center px-8 py-2">
                            <Text className="text-center text-muted text-sm">
                                {item.message.content}
                            </Text>
                        </View>
                    );
                }
                return (
                    <MessageRow
                        actor={getMessageActor(item.message, agentById)}
                        content={item.message.content}
                        createdAt={item.message.createdAt}
                        messageId={item.message.id}
                        replies={replyCountByMessage.get(item.message.id) ?? 0}
                    />
                );
            }}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            windowSize={7}
        />
    );
}

function PendingMessageRow({ message, viewer }: { message: PendingMessage; viewer: ActorSummary }) {
    return (
        <MessageRow
            actor={viewer}
            content={message.content}
            createdAt={message.createdAt}
            messageId={message.nonce}
            pending
            replies={0}
        />
    );
}

function getMessageActor(
    message: HostedChatMessage,
    agents: Map<string, AgentSummary>
): ActorSummary {
    const { author } = message;
    if (author.kind === 'agent') {
        return (
            agents.get(author.agentId) ?? {
                availability: 'offline',
                avatarUrl: author.profile?.avatarUrl ?? null,
                displayName: author.profile?.displayName ?? 'Deleted agent',
                id: author.agentId,
                kind: 'agent',
            }
        );
    }

    if (author.kind === 'human') {
        return {
            avatarUrl: author.profile?.avatarUrl ?? null,
            displayName: author.profile?.displayName ?? 'Grotto member',
            id: author.userId,
            kind: 'human',
        };
    }

    return {
        avatarUrl: null,
        displayName: author.system === 'reminder' ? 'Reminder' : 'Grotto',
        id: message.id,
        kind: 'human',
    };
}

function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(value)
    );
}
