import { Button, Label, ListBox, ProgressBar, Select, Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { type ThemePreference, useTheme } from '../../../components/theme-provider.tsx';
import {
    canCheckForDesktopUpdate,
    useDesktopUpdate,
} from '../../../hooks/desktop/use-desktop-update.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page-header.tsx';
import { SettingsFact } from '../layout/settings-text.tsx';
import { getUpdateStatusMessage, UpdateStatusMessage } from './update-status.tsx';

/**
 * Everything scoped to you on this device, on one page.
 *
 * Theme used to be its own route drawn as three window mockups, which is a lot
 * of surface for one of three values and does not survive the theme list
 * growing past three. It is a row with a picker, the way every other preference
 * will be. Updates was also its own route for two rows.
 */
export function PreferencesSettings() {
    return (
        <PageColumn>
            <SettingsPageHeader
                description="How Grotto looks and behaves on this device."
                title="Preferences"
            />
            <AppearanceSection />
            <UpdatesSection />
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

function UpdatesSection() {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();
    const [hasCheckedForUpdate, setHasCheckedForUpdate] = React.useState(false);
    const canCheck = canCheckForDesktopUpdate(status);
    const canInstall = status.phase === 'available' || status.phase === 'ready';
    const updateStatusMessage = getUpdateStatusMessage(status, hasCheckedForUpdate);

    const handleCheckForUpdate = React.useCallback(async () => {
        await checkForUpdate();
        setHasCheckedForUpdate(true);
    }, [checkForUpdate]);

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Updates</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Grotto App</ItemCard.Title>
                        <ItemCard.Description>
                            Check for and install updates to the packaged Grotto app.
                        </ItemCard.Description>
                        {updateStatusMessage ? (
                            <UpdateStatusMessage {...updateStatusMessage} />
                        ) : null}
                    </ItemCard.Content>
                    <ItemCard.Action>
                        {/* Downloading replaces the controls with their own
                            progress, the way ComputerUpdateCard does; the
                            buttons have nothing to offer mid-download. */}
                        {status.phase === 'downloading' ? (
                            <ProgressBar
                                aria-label="Download progress"
                                className="w-56 max-w-full"
                                size="sm"
                                value={status.progress * 100}
                            >
                                <Label>Downloading</Label>
                                <ProgressBar.Output />
                                <ProgressBar.Track>
                                    <ProgressBar.Fill />
                                </ProgressBar.Track>
                            </ProgressBar>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button
                                    isDisabled={!canCheck}
                                    isPending={status.phase === 'checking'}
                                    onPress={handleCheckForUpdate}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Check
                                </Button>
                                <Button
                                    isDisabled={!canInstall}
                                    isPending={status.phase === 'restarting'}
                                    onPress={updateAndRestart}
                                    size="sm"
                                >
                                    {status.phase === 'ready' ? 'Restart' : 'Update'}
                                </Button>
                            </div>
                        )}
                    </ItemCard.Action>
                </ItemCard>
                <Separator />
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Version</ItemCard.Title>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <SettingsFact>
                            <span className="font-mono text-foreground tabular-nums">
                                {import.meta.env.VITE_GROTTO_PRODUCT_VERSION ?? 'Development'}
                            </span>
                        </SettingsFact>
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
