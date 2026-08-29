import { Label, ListBox, Select } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { type ThemePreference, useTheme } from '../../../components/theme-provider.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import { GrottoVersionSummary } from '../../updates/grotto-version-summary.tsx';
import { useGrottoUpdate } from '../../updates/use-grotto-update.ts';
import { SettingsPageHeader } from '../layout/settings-page-header.tsx';

export function PreferencesSettings() {
    const update = useGrottoUpdate();
    return (
        <PageColumn>
            <SettingsPageHeader
                description="How Grotto looks and behaves on this device."
                title="Preferences"
            />
            <GrottoVersionSummary view={update.view} />
            <AppearanceSection />
        </PageColumn>
    );
}

function AppearanceSection() {
    const { setTheme, theme } = useTheme();

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Appearance</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Theme</ItemCard.Title>
                        <ItemCard.Description>
                            Applies to Grotto on this device only.
                        </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <Select
                            aria-label="Theme"
                            className="w-40"
                            onChange={(value) => setTheme(value as ThemePreference)}
                            value={theme}
                            variant="secondary"
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {themeOptions.map((option) => (
                                        <ListBox.Item
                                            id={option.id}
                                            key={option.id}
                                            textValue={option.label}
                                        >
                                            <Label>{option.label}</Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </ItemCard.Action>
                </ItemCard>
            </ItemCardGroup>
        </ItemCardGroup>
    );
}

const themeOptions: Array<{ id: ThemePreference; label: string }> = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
];
