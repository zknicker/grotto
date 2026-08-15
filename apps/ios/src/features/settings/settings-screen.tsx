import {
    ComputerIcon,
    InformationCircleIcon,
    UserCircleIcon,
    UserGroupIcon,
} from '@hugeicons-pro/core-solid-rounded';
import { useAgents, useMembers, useServerList } from '@tavern/app-client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { ListGroup } from 'heroui-native/list-group';
import { Spinner } from 'heroui-native/spinner';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppIcon } from '../../components/app-icon.tsx';
import { AgentAvatar } from '../mobile/agent-avatar.tsx';
import { AppLayout } from '../mobile/app-layout.tsx';
import { BackHeader } from '../mobile/back-header.tsx';
import { EntityAvatar } from '../mobile/entity-avatar.tsx';
import { toAgentSummary } from '../mobile/mobile-data.ts';
import { SettingsSection } from './settings-section.tsx';

export function SettingsScreen() {
    const router = useRouter();
    const { server: serverParam } = useLocalSearchParams<{ server?: string | string[] }>();
    const servers = useServerList();
    const requestedServerId = singleParam(serverParam);
    const server =
        servers.data?.find((candidate) => candidate.id === requestedServerId) ?? servers.data?.[0];
    const serverId = server?.id;
    const agents = useAgents(serverId);
    const members = useMembers(serverId);
    const viewer = members.data?.members.find(
        (member) => member.userId === members.data.viewerUserId
    );

    if (servers.isPending && !servers.data) {
        return <SettingsRouteState content={<Spinner />} title="Settings" />;
    }
    if (servers.isError && !servers.data) {
        return (
            <SettingsRouteState
                action={<Button onPress={() => servers.refetch()}>Try again</Button>}
                content="Grotto could not reach the Server."
                title="Settings"
            />
        );
    }
    if (!server) {
        return <SettingsRouteState content="No Grotto Server is available." title="Settings" />;
    }

    return (
        <AppLayout.Root>
            <BackHeader title="Settings" />
            <AppLayout.Content>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View className="gap-6 px-4 pt-2 pb-10">
                        <SettingsSection title="You">
                            <ListGroup>
                                <ListGroup.Item
                                    accessibilityLabel="Open your profile"
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push({
                                            pathname: '/settings/profile',
                                            params: { server: server.id },
                                        })
                                    }
                                >
                                    <ListGroup.ItemPrefix>
                                        {viewer ? (
                                            <EntityAvatar
                                                avatarUrl={viewer.avatarUrl}
                                                name={viewer.displayName ?? viewer.email ?? 'You'}
                                                size={36}
                                            />
                                        ) : (
                                            <AppIcon icon={UserCircleIcon} />
                                        )}
                                    </ListGroup.ItemPrefix>
                                    <ListGroup.ItemContent>
                                        <ListGroup.ItemTitle>Profile</ListGroup.ItemTitle>
                                        <ListGroup.ItemDescription>
                                            {viewer?.displayName ??
                                                viewer?.email ??
                                                'Your identity'}
                                        </ListGroup.ItemDescription>
                                    </ListGroup.ItemContent>
                                    <ListGroup.ItemSuffix />
                                </ListGroup.Item>
                            </ListGroup>
                        </SettingsSection>

                        <SettingsSection title="Grotto">
                            <ListGroup>
                                <ListGroup.Item>
                                    <ListGroup.ItemPrefix>
                                        <EntityAvatar
                                            avatarUrl={null}
                                            name={server?.displayName ?? 'Grotto'}
                                            size={44}
                                        />
                                    </ListGroup.ItemPrefix>
                                    <ListGroup.ItemContent>
                                        <ListGroup.ItemTitle>
                                            {server?.displayName ?? 'Grotto'}
                                        </ListGroup.ItemTitle>
                                        <ListGroup.ItemDescription>
                                            {formatServerCounts(
                                                agents.data?.length,
                                                members.data?.members.length,
                                                agents.isError || members.isError
                                            )}
                                        </ListGroup.ItemDescription>
                                    </ListGroup.ItemContent>
                                </ListGroup.Item>
                            </ListGroup>
                        </SettingsSection>

                        <SettingsSection title="Agent profiles">
                            {agents.isPending && !agents.data ? (
                                <View className="items-center py-8">
                                    <Spinner />
                                </View>
                            ) : agents.isError && !agents.data ? (
                                <View className="items-center gap-3 py-6">
                                    <Text className="text-center text-muted">
                                        Agent profiles could not be loaded.
                                    </Text>
                                    <Button onPress={() => agents.refetch()} size="sm">
                                        Try again
                                    </Button>
                                </View>
                            ) : agents.data?.length === 0 ? (
                                <Text className="px-1 py-3 text-muted">No Agents yet.</Text>
                            ) : (
                                <ListGroup>
                                    {agents.data?.map((agent) => (
                                        <ListGroup.Item
                                            accessibilityLabel={`Open ${agent.displayName} profile`}
                                            accessibilityRole="button"
                                            key={agent.id}
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/settings/agent/[id]',
                                                    params: { id: agent.id, server: serverId },
                                                })
                                            }
                                        >
                                            <ListGroup.ItemPrefix>
                                                <AgentAvatar
                                                    agent={toAgentSummary(agent)}
                                                    size={36}
                                                />
                                            </ListGroup.ItemPrefix>
                                            <ListGroup.ItemContent>
                                                <ListGroup.ItemTitle>
                                                    {agent.displayName}
                                                </ListGroup.ItemTitle>
                                                <ListGroup.ItemDescription numberOfLines={1}>
                                                    {agent.description ?? `@${agent.handle}`}
                                                </ListGroup.ItemDescription>
                                            </ListGroup.ItemContent>
                                            <ListGroup.ItemSuffix />
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </SettingsSection>

                        <SettingsSection title="Server">
                            <ListGroup>
                                <ListGroup.Item
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push({
                                            pathname: '/section/[id]',
                                            params: { id: 'members', server: serverId },
                                        })
                                    }
                                >
                                    <ListGroup.ItemPrefix>
                                        <AppIcon icon={UserGroupIcon} />
                                    </ListGroup.ItemPrefix>
                                    <ListGroup.ItemContent>
                                        <ListGroup.ItemTitle>People</ListGroup.ItemTitle>
                                    </ListGroup.ItemContent>
                                    <ListGroup.ItemSuffix />
                                </ListGroup.Item>
                                <ListGroup.Item
                                    accessibilityRole="button"
                                    onPress={() =>
                                        router.push({
                                            pathname: '/section/[id]',
                                            params: { id: 'computers', server: serverId },
                                        })
                                    }
                                >
                                    <ListGroup.ItemPrefix>
                                        <AppIcon icon={ComputerIcon} />
                                    </ListGroup.ItemPrefix>
                                    <ListGroup.ItemContent>
                                        <ListGroup.ItemTitle>Computers</ListGroup.ItemTitle>
                                    </ListGroup.ItemContent>
                                    <ListGroup.ItemSuffix />
                                </ListGroup.Item>
                            </ListGroup>
                        </SettingsSection>

                        <SettingsSection title="App">
                            <ListGroup>
                                <ListGroup.Item>
                                    <ListGroup.ItemPrefix>
                                        <AppIcon icon={InformationCircleIcon} />
                                    </ListGroup.ItemPrefix>
                                    <ListGroup.ItemContent>
                                        <ListGroup.ItemTitle>Grotto for iPhone</ListGroup.ItemTitle>
                                    </ListGroup.ItemContent>
                                    <ListGroup.ItemSuffix>
                                        <Text className="text-muted text-sm">Prototype</Text>
                                    </ListGroup.ItemSuffix>
                                </ListGroup.Item>
                            </ListGroup>
                        </SettingsSection>
                    </View>
                </ScrollView>
            </AppLayout.Content>
        </AppLayout.Root>
    );
}

function singleParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function SettingsRouteState({
    action,
    content,
    title,
}: {
    action?: ReactNode;
    content: ReactNode;
    title: string;
}) {
    return (
        <AppLayout.Root>
            <BackHeader title={title} />
            <AppLayout.Content>
                <View className="flex-1 items-center justify-center gap-4 px-8">
                    {typeof content === 'string' ? (
                        <Text className="text-center text-base text-muted">{content}</Text>
                    ) : (
                        content
                    )}
                    {action}
                </View>
            </AppLayout.Content>
        </AppLayout.Root>
    );
}

function formatServerCounts(
    agentCount: number | undefined,
    memberCount: number | undefined,
    didFail: boolean
) {
    if (agentCount !== undefined && memberCount !== undefined) {
        const agents = `${agentCount} ${agentCount === 1 ? 'Agent' : 'Agents'}`;
        const members = `${memberCount} ${memberCount === 1 ? 'Member' : 'Members'}`;
        return `${agents} · ${members}`;
    }
    if (!didFail) {
        return 'Loading Server details…';
    }
    if (agentCount !== undefined) {
        return `${agentCount} ${agentCount === 1 ? 'Agent' : 'Agents'}`;
    }
    if (memberCount !== undefined) {
        return `${memberCount} ${memberCount === 1 ? 'Member' : 'Members'}`;
    }
    return 'Server details unavailable';
}
