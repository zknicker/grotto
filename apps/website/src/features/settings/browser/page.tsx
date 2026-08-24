import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { useBrowserOpen } from '../../../hooks/servers/use-browser-open.ts';
import { useBrowserRestart } from '../../../hooks/servers/use-browser-restart.ts';
import { browserSaveInput, useBrowserSave } from '../../../hooks/servers/use-browser-save.ts';
import { useBrowserSettings } from '../../../hooks/servers/use-browser-settings.ts';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page.tsx';
import { SettingsFact } from '../layout/settings-text.tsx';
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
        <BrowserPage>
            <ItemCardGroup className="overflow-hidden">
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
            </ItemCardGroup>
        </BrowserPage>
    );
}

/**
 * One section, so the page title carries it. A "Browser Automation" heading
 * under a "Browser" title above a "Browser" row said the word three times.
 */
function BrowserPage({ children }: { children: React.ReactNode }) {
    return (
        <PageColumn>
            <SettingsPageHeader
                description="Browser automation for the Agents on this Server's Computer."
                title="Browser"
            />
            {children}
        </PageColumn>
    );
}

function MissingComputerSettings() {
    return (
        <BrowserPage>
            <ItemCardGroup className="overflow-hidden">
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>No Browser available</ItemCard.Title>
                        <ItemCard.Description>
                            Attach an online Computer to manage its Browser.
                        </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <SettingsFact>Waiting for a Computer</SettingsFact>
                    </ItemCard.Action>
                </ItemCard>
            </ItemCardGroup>
        </BrowserPage>
    );
}
