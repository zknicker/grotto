import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
    AiBrain01Icon,
    AtIcon,
    ComputerTerminal01Icon,
    IdentityCardIcon,
    Settings02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import {
    useAgent,
    useAgentAvatarUpdate,
    useAgentProfileUpdate,
    useServerList,
} from '@tavern/app-client';
import { Button } from 'heroui-native/button';
import { Chip } from 'heroui-native/chip';
import { Spinner } from 'heroui-native/spinner';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SettingsListGroup } from '../../components/settings-list-group.tsx';
import { SettingsSection } from '../../components/settings-section.tsx';
import { SettingsValueRow } from '../../components/settings-value-row.tsx';
import { AgentAvatar } from '../mobile/agent-avatar.tsx';
import { getAvailabilityLabel } from '../mobile/avatar-status-badge.tsx';
import { toAgentSummary } from '../mobile/mobile-data.ts';
import { AvatarUploadButton } from './avatar-upload-button.tsx';
import { ProfileIdentityForm } from './profile-identity-form.tsx';
import { SettingsBackHeader } from './settings-screen-header.tsx';

export function AgentProfileScreen({
    agentId,
    onBack,
    onEditDescription,
    serverId,
}: {
    agentId: string;
    onBack: () => void;
    onEditDescription: (profile: {
        agentId: string;
        description: string;
        displayName: string;
    }) => void;
    serverId: string;
}) {
    const servers = useServerList();
    const server = servers.data?.find((candidate) => candidate.id === serverId);
    const agent = useAgent(serverId, agentId);
    const profile = useAgentProfileUpdate(serverId, agentId);
    const avatar = useAgentAvatarUpdate(serverId, agentId);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const canEdit = server?.role === 'owner' || server?.role === 'admin';

    if (servers.isError && !servers.data) {
        return (
            <View className="flex-1">
                <SettingsBackHeader onBack={onBack} title="Agent profile" />
                <View className="flex-1 items-center justify-center gap-4 px-8">
                    <Text className="text-center text-base text-muted">
                        Grotto could not reach the Server.
                    </Text>
                    <Button onPress={() => servers.refetch()} size="sm">
                        Try again
                    </Button>
                </View>
            </View>
        );
    }
    if (!(servers.isPending || server)) {
        return (
            <View className="flex-1">
                <SettingsBackHeader onBack={onBack} title="Agent profile" />
                <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-base text-muted">
                        This Agent profile is unavailable.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1">
            <SettingsBackHeader
                onBack={onBack}
                title={agent.data?.displayName ?? 'Agent profile'}
            />
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
                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <View className="gap-6 px-4 pt-3 pb-safe-offset-3">
                        <View className="items-center gap-3 px-4 py-3">
                            <AgentAvatar agent={toAgentSummary(agent.data)} size={80} />
                            <View className="items-center gap-1">
                                <Text className="font-semibold text-2xl text-foreground">
                                    {agent.data.displayName}
                                </Text>
                                <Text className="text-base text-muted">@{agent.data.handle}</Text>
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
                            {canEdit ? (
                                <AvatarUploadButton
                                    isPending={avatar.isPending}
                                    label={`Change ${agent.data.displayName} photo`}
                                    onError={setAvatarError}
                                    onSelect={async (image) => {
                                        await avatar.mutateAsync({
                                            ...image,
                                            serverId,
                                            target: { agentId: agent.data.id, kind: 'agent' },
                                        });
                                    }}
                                />
                            ) : null}
                            {(avatarError ?? avatar.error?.message) ? (
                                <Text className="text-center text-danger text-sm">
                                    {avatarError ?? avatar.error?.message}
                                </Text>
                            ) : null}
                        </View>

                        {canEdit ? (
                            <ProfileIdentityForm
                                description={agent.data.description ?? ''}
                                displayName={agent.data.displayName}
                                error={profile.error?.message ?? null}
                                isPending={profile.isPending}
                                onEditDescription={() =>
                                    onEditDescription({
                                        agentId: agent.data.id,
                                        description: agent.data.description ?? '',
                                        displayName: agent.data.displayName,
                                    })
                                }
                                onSave={profile.save}
                            />
                        ) : null}

                        <SettingsSection title="Details">
                            <SettingsListGroup>
                                <SettingsValueRow
                                    icon={AtIcon}
                                    label="Handle"
                                    value={`@${agent.data.handle}`}
                                />
                                <SettingsValueRow
                                    icon={IdentityCardIcon}
                                    label="Role"
                                    value={capitalize(agent.data.role)}
                                />
                            </SettingsListGroup>
                        </SettingsSection>

                        <SettingsSection title="Execution">
                            <SettingsListGroup>
                                <SettingsValueRow
                                    icon={ComputerTerminal01Icon}
                                    label="Runtime"
                                    value={agent.data.desiredRuntimeId}
                                />
                                <SettingsValueRow
                                    icon={AiBrain01Icon}
                                    label="Model"
                                    value={agent.data.desiredModelId}
                                />
                                <SettingsValueRow
                                    icon={Settings02Icon}
                                    label="Configuration"
                                    value={capitalize(agent.data.status)}
                                />
                            </SettingsListGroup>
                        </SettingsSection>
                    </View>
                </BottomSheetScrollView>
            ) : (
                <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-base text-muted">
                        This Agent profile is unavailable.
                    </Text>
                </View>
            )}
        </View>
    );
}

function capitalize(value: string): string {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
