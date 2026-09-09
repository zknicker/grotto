import { ItemCardGroup } from '@heroui-pro/react';
import { useBrowserOpen } from '../../hooks/servers/use-browser-open.ts';
import { useBrowserRestart } from '../../hooks/servers/use-browser-restart.ts';
import { browserSaveInput, useBrowserSave } from '../../hooks/servers/use-browser-save.ts';
import { useBrowserSettings } from '../../hooks/servers/use-browser-settings.ts';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { BrowserSettingsCard } from '../settings/browser/browser-settings-card.tsx';

/** Browser is a Computer capability: every operation keeps the detail's target. */
export function BrowserCapabilityCard({
    computerId,
    serverId,
}: {
    computerId: string;
    serverId: string;
}) {
    const target = { computerId, serverId };
    const settings = useBrowserSettings(target);
    const open = useBrowserOpen(target);
    const restart = useBrowserRestart(target);
    const save = useBrowserSave(target);

    return (
        <section>
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>Browser</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCardGroup className="overflow-hidden">
                    <BrowserSettingsCard
                        error={
                            settings.error?.message ??
                            save.error?.message ??
                            open.error?.message ??
                            restart.error?.message ??
                            null
                        }
                        isActionPending={open.isPending || restart.isPending}
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
            </ItemCardGroup>
        </section>
    );
}
