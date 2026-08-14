import { BubbleChatIcon, File01Icon } from '@hugeicons-pro/core-solid-rounded';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { PressableFeedback } from 'heroui-native/pressable-feedback';
import { FlatList, Text, View } from 'react-native';

import { AgentAvatar } from './agent-avatar';
import { AppIcon } from './app-icon';
import { EntityAvatar } from './entity-avatar';
import { actors, messages } from './fixtures';
import type { ActorSummary, ChatMessage } from './types';

const actorById = new Map(actors.map((actor) => [actor.id, actor]));
const unknownActor: ActorSummary = {
    avatarUrl: null,
    displayName: 'Unknown participant',
    id: 'unknown',
    kind: 'human',
};

function MessageRow({ message }: { message: ChatMessage }) {
    const router = useRouter();
    const artifact = message.artifact;
    const actor = actorById.get(message.authorId) ?? unknownActor;

    return (
        <View className="flex-row items-start gap-3 px-4 py-1.5">
            <MessageAvatar actor={actor} />
            <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-baseline gap-2">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>
                        {actor.displayName}
                    </Text>
                    <Text className="text-muted text-xs tabular-nums">{message.timestamp}</Text>
                </View>

                <Text className="text-base text-foreground leading-5">{message.body}</Text>

                {artifact ? (
                    <Button
                        accessibilityLabel={`Open ${artifact.title}`}
                        className="w-full justify-start"
                        onPress={() =>
                            router.push({
                                pathname: '/artifact/[id]',
                                params: { id: artifact.id },
                            })
                        }
                        size="sm"
                        variant="secondary"
                    >
                        <AppIcon icon={File01Icon} size={16} tone="accent" />
                        <View className="min-w-0 flex-1">
                            <Text className="font-medium text-foreground" numberOfLines={1}>
                                {artifact.title}
                            </Text>
                            <Text className="text-muted text-xs">{artifact.kind}</Text>
                        </View>
                        <AppIcon icon={ArrowRight01Icon} size={16} tone="muted" />
                    </Button>
                ) : null}

                {message.replies ? (
                    <PressableFeedback
                        accessibilityLabel={`${message.replies} replies`}
                        accessibilityRole="button"
                        className="min-h-7 flex-row items-center gap-1.5 self-start"
                        hitSlop={10}
                        onPress={() =>
                            router.push({ pathname: '/thread/[id]', params: { id: message.id } })
                        }
                    >
                        <AppIcon icon={BubbleChatIcon} size={16} tone="accent" />
                        <Text className="font-medium text-accent text-sm">
                            {message.replies} replies
                        </Text>
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

export function ChatTimeline() {
    return (
        <FlatList
            contentContainerClassName="gap-2 py-3"
            data={messages}
            initialNumToRender={10}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            maxToRenderPerBatch={8}
            renderItem={({ item }) => <MessageRow message={item} />}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            windowSize={7}
        />
    );
}
