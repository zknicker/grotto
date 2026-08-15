import { BubbleChatIcon } from '@hugeicons-pro/core-solid-rounded';
import type { ChatMessage, MessageTask, ThreadSummary } from '@tavern/api';
import { useAgents, useMembers } from '@tavern/app-client';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native/pressable-feedback';
import { Spinner } from 'heroui-native/spinner';
import { useMemo } from 'react';
import { ActionSheetIOS, FlatList, Text, View } from 'react-native';
import { AppIcon } from '../../components/app-icon.tsx';
import { AgentAvatar } from './agent-avatar.tsx';
import { EntityAvatar } from './entity-avatar.tsx';
import { MessageTaskChip } from './message-task-chip.tsx';
import { isVisibleTimelineMessage, toAgentSummary } from './mobile-data.ts';
import type { PendingMessage } from './pending-messages.ts';
import type { ActorSummary, AgentSummary } from './types.ts';

export function MessageTimelineList({
    hasOlderHistory,
    isFetchingOlderHistory,
    messages,
    onFetchOlder,
    parentChatId,
    pendingMessages,
    serverId,
    threads,
}: {
    hasOlderHistory: boolean;
    isFetchingOlderHistory: boolean;
    messages: ChatMessage[];
    onFetchOlder: () => void;
    parentChatId?: string;
    pendingMessages: readonly PendingMessage[];
    serverId: string;
    threads: ThreadSummary[];
}) {
    const agents = useAgents(serverId).data?.map(toAgentSummary) ?? [];
    const members = useMembers(serverId).data;
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const viewer = members?.members.find((member) => member.userId === members.viewerUserId);
    const threadByMessageId = new Map(threads.map((thread) => [thread.anchorMessageId, thread]));
    const rows = useMemo(
        () =>
            [
                ...messages
                    .filter(isVisibleTimelineMessage)
                    .map((message) => ({ kind: 'durable' as const, message })),
                ...pendingMessages.map((message) => ({ kind: 'pending' as const, message })),
            ].reverse(),
        [messages, pendingMessages]
    );

    return (
        <FlatList
            contentContainerClassName="gap-2 py-3"
            data={rows}
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
                if (hasOlderHistory && !isFetchingOlderHistory) {
                    onFetchOlder();
                }
            }}
            onEndReachedThreshold={0.3}
            renderItem={({ item }) => {
                if (item.kind === 'pending') {
                    return (
                        <MessageRow
                            actor={{
                                avatarUrl: viewer?.avatarUrl ?? null,
                                displayName: viewer?.displayName ?? 'You',
                                id: members?.viewerUserId ?? 'viewer',
                                kind: 'human',
                            }}
                            content={item.message.content}
                            createdAt={item.message.createdAt}
                            pending
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
                        parentChatId={parentChatId}
                        serverId={serverId}
                        task={item.message.task}
                        thread={threadByMessageId.get(item.message.id)}
                    />
                );
            }}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            windowSize={7}
        />
    );
}

function MessageRow({
    actor,
    content,
    createdAt,
    messageId,
    parentChatId,
    pending = false,
    serverId,
    task,
    thread,
}: {
    actor: ActorSummary;
    content: string;
    createdAt: string;
    messageId?: string;
    parentChatId?: string;
    pending?: boolean;
    serverId?: string;
    task?: MessageTask | null;
    thread?: ThreadSummary;
}) {
    const router = useRouter();
    const renderedContent = content.trimEnd();
    const canOpenThread = Boolean(messageId && parentChatId && serverId);
    const openThread = () => {
        if (!(messageId && parentChatId && serverId)) {
            return;
        }
        router.push({
            pathname: '/thread/[id]',
            params: {
                id: messageId,
                parentChatId,
                serverId,
                ...(thread ? { threadChatId: thread.threadChatId } : {}),
            },
        });
    };
    const openMessageActions = () => {
        ActionSheetIOS.showActionSheetWithOptions(
            {
                cancelButtonIndex: 1,
                options: [thread ? 'Open Thread' : 'Reply in Thread', 'Cancel'],
                title: actor.displayName,
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    openThread();
                }
            }
        );
    };

    return (
        <View className={`px-4 py-1.5 ${pending ? 'opacity-60' : ''}`}>
            <PressableFeedback
                accessibilityHint={canOpenThread ? 'Long press for message actions' : undefined}
                accessibilityLabel={
                    canOpenThread
                        ? `Message from ${actor.displayName}: ${renderedContent}`
                        : undefined
                }
                accessibilityRole={canOpenThread ? 'button' : undefined}
                className="flex-row items-start gap-3"
                delayLongPress={250}
                onLongPress={canOpenThread ? openMessageActions : undefined}
            >
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
                    <Text className="text-base text-foreground leading-5">{renderedContent}</Text>
                    {task ? (
                        <View className="flex-row self-start">
                            <MessageTaskChip task={task} />
                        </View>
                    ) : null}
                    {pending ? (
                        <View className="flex-row items-center gap-1.5">
                            <Spinner size="sm" />
                            <Text className="text-muted text-xs">Sending</Text>
                        </View>
                    ) : null}
                </View>
            </PressableFeedback>
            {thread && parentChatId && serverId ? (
                <PressableFeedback
                    accessibilityLabel={`${thread.replyCount} replies`}
                    accessibilityRole="button"
                    className="mt-1 ml-12 min-h-7 flex-row items-center gap-1.5 self-start"
                    hitSlop={10}
                    onPress={openThread}
                >
                    <AppIcon icon={BubbleChatIcon} size={16} tone="accent" />
                    <Text className="font-medium text-accent text-sm">
                        {thread.replyCount} replies
                    </Text>
                </PressableFeedback>
            ) : null}
        </View>
    );
}

function MessageAvatar({ actor }: { actor: ActorSummary }) {
    return actor.kind === 'agent' ? (
        <AgentAvatar agent={actor} size={36} />
    ) : (
        <EntityAvatar avatarUrl={actor.avatarUrl} name={actor.displayName} size={36} />
    );
}

function getMessageActor(message: ChatMessage, agents: Map<string, AgentSummary>): ActorSummary {
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
