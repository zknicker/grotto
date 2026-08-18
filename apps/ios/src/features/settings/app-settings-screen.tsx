import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
    CodeIcon,
    InformationCircleIcon,
    SmartPhone01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Text, View } from 'react-native';
import { SettingsListGroup } from '../../components/settings-list-group.tsx';
import { SettingsSection } from '../../components/settings-section.tsx';
import { SettingsValueRow } from '../../components/settings-value-row.tsx';
import { appConfig } from '../../lib/app-config.ts';
import { SettingsBackHeader } from './settings-screen-header.tsx';

export function AppSettingsScreen({ onBack }: { onBack: () => void }) {
    return (
        <View className="flex-1">
            <SettingsBackHeader onBack={onBack} title="Grotto for iPhone" />
            <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-6 px-4 pt-2 pb-safe-offset-3">
                    <SettingsSection title="About">
                        <SettingsListGroup>
                            <SettingsValueRow
                                icon={InformationCircleIcon}
                                label="App"
                                value="Grotto"
                            />
                            <SettingsValueRow
                                icon={SmartPhone01Icon}
                                label="Platform"
                                value="iPhone"
                            />
                            <SettingsValueRow
                                icon={CodeIcon}
                                label="Version"
                                value={appConfig.productVersion}
                            />
                        </SettingsListGroup>
                    </SettingsSection>
                    <Text className="px-3 text-muted text-sm">
                        A native client for your Grotto Server and Computers.
                    </Text>
                </View>
            </BottomSheetScrollView>
        </View>
    );
}
