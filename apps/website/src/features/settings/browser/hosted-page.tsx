import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import {
    hostedBrowserSaveInput,
    useHostedBrowserCommands,
    useHostedBrowserSettings,
} from '../../../hooks/servers/use-hosted-browser-settings.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { BrowserSettingsCard } from './browser-settings-card.tsx';

export function HostedBrowserSettingsPage({
    computerId,
    serverId,
}: {
    computerId: string;
    serverId: string;
}) {
    const target = { computerId, serverId };
    const settings = useHostedBrowserSettings(target);
    const commands = useHostedBrowserCommands(target);

    return (
        <SettingsPage>
            <SettingsPageHeader title="Browser" />
            <SettingsSection title="Browser automation">
                <SettingsGroup>
                    <BrowserSettingsCard
                        error={
                            settings.error?.message ??
                            commands.save.error?.message ??
                            commands.open.error?.message ??
                            commands.restart.error?.message ??
                            null
                        }
                        isLoading={settings.isPending}
                        isSaving={commands.save.isPending}
                        onOpenBrowser={() =>
                            commands.open.mutateAsync(target).catch(() => undefined)
                        }
                        onRestartBrowser={() =>
                            commands.restart.mutateAsync(target).catch(() => undefined)
                        }
                        onSave={(input) =>
                            withSavingToast(() =>
                                commands.save.mutateAsync(hostedBrowserSaveInput(target, input))
                            ).catch(() => undefined)
                        }
                        settings={settings.data ?? null}
                    />
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}
