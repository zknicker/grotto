import { Search01Icon } from '@hugeicons-pro/core-solid-rounded';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useAgents, useMembers, useServerList } from '@tavern/app-client';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { Surface } from 'heroui-native/surface';
import { ScrollView, Text, View } from 'react-native';
import { AppIcon } from './app-icon.tsx';
import { AppLayout } from './app-layout.tsx';
import { ChatNavigation } from './chat-navigation.tsx';

export function Sidebar({
    activeChat,
    onNavigate,
    onSelectChat,
    serverId,
}: {
    activeChat: string | undefined;
    onNavigate: () => void;
    onSelectChat: (id: string) => void;
    serverId: string;
}) {
    const router = useRouter();
    const servers = useServerList();
    const agents = useAgents(serverId);
    const members = useMembers(serverId);
    const server = servers.data?.find((candidate) => candidate.id === serverId);
    const serverCounts =
        agents.data && members.data
            ? formatServerCounts(agents.data.length, members.data.members.length)
            : ' ';
    const openSection = (id: string) => {
        onNavigate();
        if (id === 'settings') {
            router.push({ pathname: '/settings', params: { server: serverId } });
            return;
        }
        router.push({ pathname: '/section/[id]', params: { id } });
    };

    return (
        <AppLayout.Root>
            <Surface className="flex-1 rounded-none p-0" variant="transparent">
                <AppLayout.Header>
                    <Button
                        accessibilityLabel={`Open ${server?.displayName ?? 'Grotto'} settings`}
                        className="h-12 min-h-12 flex-1 justify-start px-4"
                        onPress={() => openSection('settings')}
                        size="sm"
                        variant="ghost"
                    >
                        <View className="min-w-0 flex-1 items-start">
                            <View className="flex-row items-center gap-1">
                                <Text
                                    className="font-semibold text-foreground text-lg/5"
                                    numberOfLines={1}
                                >
                                    {server?.displayName ?? 'Grotto'}
                                </Text>
                                <AppIcon icon={ArrowRight01Icon} size={12} tone="muted" />
                            </View>
                            <Text className="text-muted text-sm/4" numberOfLines={1}>
                                {serverCounts}
                            </Text>
                        </View>
                    </Button>
                </AppLayout.Header>
                <AppLayout.Content>
                    <View className="flex-1">
                        <View className="pt-2 pr-6 pb-2 pl-3">
                            <Button
                                className="w-full justify-start"
                                onPress={() => openSection('search')}
                                size="sm"
                                variant="tertiary"
                            >
                                <AppIcon icon={Search01Icon} />
                                <Button.Label>Search</Button.Label>
                            </Button>
                        </View>
                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            <View className="gap-1 px-6 py-1">
                                <ChatNavigation
                                    activeChat={activeChat}
                                    onCreateChannel={() => openSection('new-channel')}
                                    onOpenArchived={() => openSection('archived')}
                                    onSelectChat={onSelectChat}
                                    serverId={serverId}
                                />
                            </View>
                        </ScrollView>
                    </View>
                </AppLayout.Content>
            </Surface>
        </AppLayout.Root>
    );
}

function formatServerCounts(agentCount: number, memberCount: number): string {
    const agentsLabel = `${agentCount} ${agentCount === 1 ? 'Agent' : 'Agents'}`;
    const membersLabel = `${memberCount} ${memberCount === 1 ? 'Member' : 'Members'}`;
    return `${agentsLabel} · ${membersLabel}`;
}
