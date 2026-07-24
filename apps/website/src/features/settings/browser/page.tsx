import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import {
    useBrowserSettings,
    useOpenBrowser,
    useRestartBrowser,
    useSaveBrowserSettings,
} from '../../../hooks/browser/use-browser-settings.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { BrowserSettingsCard } from './browser-settings-card.tsx';

export function BrowserSettingsPage() {
    const settings = useBrowserSettings();
    const save = useSaveBrowserSettings();
    const open = useOpenBrowser();
    const restart = useRestartBrowser();
    return (
        <SettingsPage>
            <SettingsPageHeader title="Browser" />
            <SettingsSection title="Browser automation">
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
                        onOpenBrowser={() => open.mutateAsync().catch(() => undefined)}
                        onRestartBrowser={() => restart.mutateAsync().catch(() => undefined)}
                        onSave={(input) =>
                            withSavingToast(() => save.mutateAsync(input)).catch(() => undefined)
                        }
                        settings={settings.data ?? null}
                    />
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}
