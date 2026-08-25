import { Button, Label, ProgressBar, Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    canCheckForDesktopUpdate,
    type DesktopUpdateStatus,
    useDesktopUpdate,
} from '../../../hooks/desktop/use-desktop-update.ts';
import { cn } from '../../../lib/utils.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page.tsx';
import { SettingsFact } from '../layout/settings-text.tsx';

export function UpdatesSettings({ computerSettingsHref }: { computerSettingsHref?: string }) {
    const navigate = useNavigate();
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
        <PageColumn>
            <SettingsPageHeader title="Updates" />
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>Grotto Updates</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCardGroup className="overflow-hidden">
                    <ItemCard>
                        <ItemCard.Content>
                            <ItemCard.Title>Update</ItemCard.Title>
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
                            <ItemCard.Title>App Version</ItemCard.Title>
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
            {computerSettingsHref ? (
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header>
                        <ItemCardGroup.Title>Computer Updates</ItemCardGroup.Title>
                    </ItemCardGroup.Header>
                    <ItemCardGroup className="overflow-hidden">
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Title>Grotto Computers</ItemCard.Title>
                                <ItemCard.Description>
                                    Each attached Computer reports its own version and update state.
                                </ItemCard.Description>
                            </ItemCard.Content>
                            <ItemCard.Action>
                                <Button
                                    onPress={() => navigate(computerSettingsHref)}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Manage Computers
                                </Button>
                            </ItemCard.Action>
                        </ItemCard>
                    </ItemCardGroup>
                </ItemCardGroup>
            ) : null}
        </PageColumn>
    );
}

function UpdateStatusMessage({
    detail,
    tone,
}: {
    detail: string;
    tone: 'error' | 'neutral' | 'success';
}) {
    return (
        <p
            className={cn(
                'mt-1 font-medium text-xs',
                tone === 'success' && 'text-success',
                tone === 'error' && 'text-danger',
                tone === 'neutral' && 'text-muted'
            )}
            role={tone === 'error' ? 'alert' : undefined}
        >
            {detail}
        </p>
    );
}

export function getUpdateStatusMessage(
    status: DesktopUpdateStatus,
    hasCheckedForUpdate: boolean
): null | {
    detail: string;
    tone: 'error' | 'neutral' | 'success';
} {
    switch (status.phase) {
        case 'current':
            return hasCheckedForUpdate ? { detail: 'Up to date', tone: 'success' } : null;
        case 'available':
        case 'ready':
            return {
                detail: `Grotto v${status.version} is available.`,
                tone: 'neutral',
            };
        case 'error':
            return { detail: status.message, tone: 'error' };
        case 'checking':
        case 'unsupported':
            return hasCheckedForUpdate
                ? {
                      detail:
                          status.phase === 'unsupported'
                              ? 'App updates are installed through the packaged Mac app.'
                              : 'Checking for updates…',
                      tone: 'neutral',
                  }
                : null;
        case 'downloading':
        case 'restarting':
        case 'idle':
            return null;
    }
}
