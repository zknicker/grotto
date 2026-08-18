import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
    ComputerIcon,
    InformationCircleIcon,
    PaintBrush03Icon,
    ServerStack01Icon,
    UserCircleIcon,
    UserGroupIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { useAgents, useMembers, useServerList } from '@tavern/app-client';
import { Button } from 'heroui-native/button';
import { ListGroup } from 'heroui-native/list-group';
import { Spinner } from 'heroui-native/spinner';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '../../components/app-icon.tsx';
import { SettingsDisclosureRow } from '../../components/settings-disclosure-row.tsx';
import { SettingsListGroup } from '../../components/settings-list-group.tsx';
import { SettingsSection } from '../../components/settings-section.tsx';
import { SettingsSelectRow } from '../../components/settings-select-row.tsx';
import { AgentAvatar } from '../mobile/agent-avatar.tsx';
import { EntityAvatar } from '../mobile/entity-avatar.tsx';
import { toAgentSummary } from '../mobile/mobile-data.ts';
import { SettingsRootHeader } from './settings-screen-header.tsx';
import { type ThemePreference, useThemePreference } from './theme-preference.tsx';

const THEME_OPTIONS = [
    { label: 'System', value: 'system' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
] as const satisfies readonly { label: string; value: ThemePreference }[];

export function SettingsScreen({
    onClose,
    onOpenAgent,
    onOpenApp,
    onOpenProfile,
    onOpenServer,
    onOpenSection,
    serverId,
}: {
    onClose: () => void;
    onOpenAgent: (agentId: string) => void;
    onOpenApp: () => void;
    onOpenProfile: () => void;
    onOpenServer: () => void;
    onOpenSection: (sectionId: string) => void;
    serverId: string;
}) {
    const servers = useServerList();
    const server = servers.data?.find((candidate) => candidate.id === serverId);
    const agents = useAgents(serverId);
    const members = useMembers(serverId);
    const viewer = members.data?.members.find(
        (member) => member.userId === members.data.viewerUserId
    );
    const { preference, setPreference } = useThemePreference();

    if (servers.isPending && !servers.data) {
        return <SettingsState content={<Spinner />} onClose={onClose} />;
    }
    if (servers.isError && !servers.data) {
        return (
            <SettingsState
                action={<Button onPress={() => servers.refetch()}>Try again</Button>}
                content="Grotto could not reach the Server."
                onClose={onClose}
            />
        );
    }
    if (!server) {
        return <SettingsState content="No Grotto Server is available." onClose={onClose} />;
    }

    return (
        <View className="flex-1">
            <SettingsRootHeader onClose={onClose} />
            <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-6 px-4 pt-2 pb-safe-offset-3">
                    <SettingsSection title="You">
                        <SettingsListGroup>
                            <ListGroup.Item
                                accessibilityLabel="Open your profile"
                                accessibilityRole="button"
                                onPress={onOpenProfile}
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
                                        {viewer?.displayName ?? viewer?.email ?? 'Your identity'}
                                    </ListGroup.ItemDescription>
                                </ListGroup.ItemContent>
                                <ListGroup.ItemSuffix />
                            </ListGroup.Item>
                        </SettingsListGroup>
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
                            <SettingsListGroup>
                                {agents.data?.map((agent) => (
                                    <ListGroup.Item
                                        accessibilityLabel={`Open ${agent.displayName} profile`}
                                        accessibilityRole="button"
                                        key={agent.id}
                                        onPress={() => onOpenAgent(agent.id)}
                                    >
                                        <ListGroup.ItemPrefix>
                                            <AgentAvatar agent={toAgentSummary(agent)} size={36} />
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
                            </SettingsListGroup>
                        )}
                    </SettingsSection>

                    <SettingsSection title="Server">
                        <SettingsListGroup>
                            <SettingsDisclosureRow
                                icon={ServerStack01Icon}
                                onPress={onOpenServer}
                                title="Server"
                            />
                            <SettingsDisclosureRow
                                icon={UserGroupIcon}
                                onPress={() => onOpenSection('members')}
                                title="People"
                            />
                            <SettingsDisclosureRow
                                icon={ComputerIcon}
                                onPress={() => onOpenSection('computers')}
                                title="Computers"
                            />
                        </SettingsListGroup>
                    </SettingsSection>

                    <SettingsSection title="App">
                        <SettingsListGroup>
                            <SettingsSelectRow
                                icon={PaintBrush03Icon}
                                onValueChange={setPreference}
                                options={THEME_OPTIONS}
                                title="Appearance"
                                value={preference}
                            />
                            <SettingsDisclosureRow
                                icon={InformationCircleIcon}
                                onPress={onOpenApp}
                                title="Grotto for iPhone"
                            />
                        </SettingsListGroup>
                    </SettingsSection>
                </View>
            </BottomSheetScrollView>
        </View>
    );
}

function SettingsState({
    action,
    content,
    onClose,
}: {
    action?: ReactNode;
    content: ReactNode;
    onClose: () => void;
}) {
    return (
        <View className="flex-1">
            <SettingsRootHeader onClose={onClose} />
            <View className="flex-1 items-center justify-center gap-4 px-8">
                {typeof content === 'string' ? (
                    <Text className="text-center text-base text-muted">{content}</Text>
                ) : (
                    content
                )}
                {action}
            </View>
        </View>
    );
}
