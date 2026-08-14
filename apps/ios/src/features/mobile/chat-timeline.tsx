import { BubbleChatIcon } from '@hugeicons-pro/core-solid-rounded';
import type { HostedChatMessage } from '@tavern/api';
import { useAgents, useChatMessages } from '@tavern/app-client';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native/pressable-feedback';
import { Spinner } from 'heroui-native/spinner';
import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

import { AgentAvatar } from './agent-avatar';
import { AppIcon } from './app-icon';
import { EntityAvatar } from './entity-avatar';
import { toAgentSummary } from './mobile-data';
import type { ActorSummary, AgentSummary } from './types';

function MessageRow({
    agents,
    message,
    replies,
}: {
    agents: Map<string, AgentSummary>;
    message: HostedChatMessage;
    replies: number;
}) {
    const router = useRouter();

    if (message.author.kind === 'system') {
        return (
            <View className="items-center px-8 py-2">
                <Text className="text-center text-muted text-sm">{message.content}</Text>
            </View>
        );
    }

    const actor = getMessageActor(message, agents);

    return (
        <View className="flex-row items-start gap-3 px-4 py-1.5">
            <MessageAvatar actor={actor} />
            <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-baseline gap-2">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>
                        {actor.displayName}
                    </Text>
                    <Text className="text-muted text-xs tabular-nums">
                        {formatTimestamp(message.createdAt)}
                    </Text>
                </View>

                <Text className="text-base text-foreground leading-5">{message.content}</Text>

                {replies > 0 ? (
                    <PressableFeedback
                        accessibilityLabel={`${replies} replies`}
                        accessibilityRole="button"
                        className="min-h-7 flex-row items-center gap-1.5 self-start"
                        hitSlop={10}
                        onPress={() =>
                            router.push({ pathname: '/thread/[id]', params: { id: message.id } })
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
    const messages = useChatMessages(serverId, chatId);
    const agents = useAgents(serverId).data?.map(toAgentSummary) ?? [];
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const timelineMessages = useMemo(
        () => [...(messages.data?.messages ?? [])].reverse(),
        [messages.data?.messages]
    );
    const replyCountByMessage = new Map(
        messages.data?.threads.map((thread) => [thread.anchorMessageId, thread.replyCount]) ?? []
    );

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
            keyExtractor={(item) => item.id}
            maxToRenderPerBatch={8}
            renderItem={({ item }) => (
                <MessageRow
                    agents={agentById}
                    message={item}
                    replies={replyCountByMessage.get(item.id) ?? 0}
                />
            )}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            windowSize={7}
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
