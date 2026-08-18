import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
    Globe02Icon,
    ServerStack01Icon,
    UserShield01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { useServerList } from '@tavern/app-client';
import { Spinner } from 'heroui-native/spinner';
import { Text, View } from 'react-native';
import { SettingsListGroup } from '../../components/settings-list-group.tsx';
import { SettingsSection } from '../../components/settings-section.tsx';
import { SettingsValueRow } from '../../components/settings-value-row.tsx';
import { SettingsBackHeader } from './settings-screen-header.tsx';

export function ServerSettingsScreen({
    onBack,
    serverId,
}: {
    onBack: () => void;
    serverId: string;
}) {
    const servers = useServerList();
    const server = servers.data?.find((candidate) => candidate.id === serverId);

    return (
        <View className="flex-1">
            <SettingsBackHeader onBack={onBack} title="Server" />
            {server ? (
                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <View className="gap-6 px-4 pt-2 pb-safe-offset-3">
                        <SettingsSection title="Identity">
                            <SettingsListGroup>
                                <SettingsValueRow
                                    icon={ServerStack01Icon}
                                    label="Name"
                                    value={server.displayName}
                                />
                                <SettingsValueRow
                                    icon={Globe02Icon}
                                    label="Address"
                                    value={`/${server.slug}`}
                                />
                                <SettingsValueRow
                                    icon={UserShield01Icon}
                                    label="Your role"
                                    value={formatRole(server.role)}
                                />
                            </SettingsListGroup>
                        </SettingsSection>
                        <Text className="px-3 text-muted text-sm">
                            Server identity is shared with every Grotto client.
                        </Text>
                    </View>
                </BottomSheetScrollView>
            ) : servers.isPending ? (
                <View className="flex-1 items-center justify-center">
                    <Spinner />
                </View>
            ) : (
                <View className="flex-1 items-center justify-center px-8">
                    <Text className="text-center text-base text-muted">
                        Server settings could not be loaded.
                    </Text>
                </View>
            )}
        </View>
    );
}

function formatRole(role: string) {
    return `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`;
}
