import { useBrowserOpen } from '../../../hooks/servers/use-browser-open.ts';
import { useBrowserRestart } from '../../../hooks/servers/use-browser-restart.ts';
import { browserSaveInput, useBrowserSave } from '../../../hooks/servers/use-browser-save.ts';
import { useBrowserSettings } from '../../../hooks/servers/use-browser-settings.ts';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../layout/settings-page.tsx';
import { BrowserSettingsCard } from './browser-settings-card.tsx';

export function BrowserSettingsPage({ serverId }: { serverId: string }) {
    const computers = useComputers(serverId);
    const computer = computers.data?.find((item) => item.health === 'healthy');

    if (!computer) {
        return <MissingComputerSettings />;
    }

    return <BrowserSettings computerId={computer.id} serverId={serverId} />;
}

function BrowserSettings({ computerId, serverId }: { computerId: string; serverId: string }) {
    const target = { computerId, serverId };
    const settings = useBrowserSettings(target);
    const open = useBrowserOpen(target);
    const restart = useBrowserRestart(target);
    const save = useBrowserSave(target);

    return (
        <SettingsPage>
            <SettingsPageHeader title="Browser" />
            <SettingsSection title="Browser Automation">
                <SettingsGroup>
                    <BrowserSettingsCard
                        error={
                            settings.error?.message ??
                            save.error?.message ??
                            open.error?.message ??
                            restart.error?.message ??
                            null
                        }
                        isLoading={settings.isPending}
                        isSaving={save.isPending}
                        onOpenBrowser={() => open.mutateAsync(target).catch(() => undefined)}
                        onRestartBrowser={() => restart.mutateAsync(target).catch(() => undefined)}
                        onSave={(input) =>
                            withSavingToast(() =>
                                save.mutateAsync(browserSaveInput(target, input))
                            ).catch(() => undefined)
                        }
                        settings={settings.data ?? null}
                    />
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function MissingComputerSettings() {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Browser" />
            <SettingsSection title="Browser">
                <SettingsGroup>
                    <SettingsRow
                        description="Attach an online Computer to manage its Browser."
                        title="No Browser available"
                    >
                        <SettingsValue>Waiting for a Computer</SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}
