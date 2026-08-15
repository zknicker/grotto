import { useAgent, useServerList } from '@tavern/app-client';
import { useLocalSearchParams } from 'expo-router';
import { Button } from 'heroui-native/button';
import { Chip } from 'heroui-native/chip';
import { ListGroup } from 'heroui-native/list-group';
import { Spinner } from 'heroui-native/spinner';
import { ScrollView, Text, View } from 'react-native';
import { AgentAvatar } from '../mobile/agent-avatar.tsx';
import { AppLayout } from '../mobile/app-layout.tsx';
import { getAvailabilityLabel } from '../mobile/avatar-status-badge.tsx';
import { BackHeader } from '../mobile/back-header.tsx';
import { toAgentSummary } from '../mobile/mobile-data.ts';
import { SettingsSection } from './settings-section.tsx';

export function AgentProfileScreen() {
    const { id: idParam, server: serverParam } = useLocalSearchParams<{
        id?: string | string[];
        server?: string | string[];
    }>();
    const agentId = singleParam(idParam);
    const servers = useServerList();
    const requestedServerId = singleParam(serverParam);
    const serverId =
        servers.data?.find((server) => server.id === requestedServerId)?.id ??
        servers.data?.[0]?.id;
    const agent = useAgent(serverId, agentId);

    if (servers.isError && !servers.data) {
        return (
            <AppLayout.Root>
                <BackHeader title="Agent profile" />
                <AppLayout.Content>
                    <View className="flex-1 items-center justify-center gap-4 px-8">
                        <Text className="text-center text-base text-muted">
                            Grotto could not reach the Server.
                        </Text>
                        <Button onPress={() => servers.refetch()} size="sm">
                            Try again
                        </Button>
                    </View>
                </AppLayout.Content>
            </AppLayout.Root>
        );
    }
    if (!((servers.isPending || serverId) && agentId)) {
        return (
            <AppLayout.Root>
                <BackHeader title="Agent profile" />
                <AppLayout.Content>
                    <View className="flex-1 items-center justify-center px-8">
                        <Text className="text-center text-base text-muted">
                            This Agent profile is unavailable.
                        </Text>
                    </View>
                </AppLayout.Content>
            </AppLayout.Root>
        );
    }

    return (
        <AppLayout.Root>
            <BackHeader title={agent.data?.displayName ?? 'Agent profile'} />
            <AppLayout.Content>
                {agent.isPending && !agent.data ? (
                    <View className="flex-1 items-center justify-center">
                        <Spinner />
                    </View>
                ) : agent.isError && !agent.data ? (
                    <View className="flex-1 items-center justify-center gap-4 px-8">
                        <Text className="text-center text-base text-muted">
                            This Agent profile could not be loaded.
                        </Text>
                        <Button onPress={() => agent.refetch()} size="sm">
                            Try again
                        </Button>
                    </View>
                ) : agent.data ? (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="gap-6 px-4 pt-3 pb-10">
                            <View className="items-center gap-3 px-4 py-3">
                                <AgentAvatar agent={toAgentSummary(agent.data)} size={80} />
                                <View className="items-center gap-1">
                                    <Text className="font-semibold text-2xl text-foreground">
                                        {agent.data.displayName}
                                    </Text>
                                    <Text className="text-base text-muted">
                                        @{agent.data.handle}
                                    </Text>
                                </View>
                                <Chip color="default" size="sm" variant="soft">
                                    <Chip.Label>
                                        {getAvailabilityLabel(agent.data.availability)}
                                    </Chip.Label>
                                </Chip>
                                {agent.data.description ? (
                                    <Text className="text-center text-base text-foreground/90 leading-6">
                                        {agent.data.description}
                                    </Text>
                                ) : null}
                            </View>

                            <SettingsSection title="Identity">
                                <ListGroup>
                                    <ProfileValue label="Name" value={agent.data.displayName} />
                                    <ProfileValue label="Handle" value={`@${agent.data.handle}`} />
                                    <ProfileValue
                                        label="Role"
                                        value={capitalize(agent.data.role)}
                                    />
                                </ListGroup>
                            </SettingsSection>

                            <SettingsSection title="Execution">
                                <ListGroup>
                                    <ProfileValue
                                        label="Runtime"
                                        value={agent.data.desiredRuntimeId}
                                    />
                                    <ProfileValue label="Model" value={agent.data.desiredModelId} />
                                    <ProfileValue
                                        label="Configuration"
                                        value={capitalize(agent.data.status)}
                                    />
                                </ListGroup>
                            </SettingsSection>
                        </View>
                    </ScrollView>
                ) : (
                    <View className="flex-1 items-center justify-center px-8">
                        <Text className="text-center text-base text-muted">
                            This Agent profile is unavailable.
                        </Text>
                    </View>
                )}
            </AppLayout.Content>
        </AppLayout.Root>
    );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
    return (
        <ListGroup.Item>
            <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
                <Text className="max-w-52 text-right text-muted text-sm" numberOfLines={1}>
                    {value}
                </Text>
            </ListGroup.ItemSuffix>
        </ListGroup.Item>
    );
}

function singleParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function capitalize(value: string): string {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
