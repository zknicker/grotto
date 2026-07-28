import { SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Progress } from '../../../components/ui/progress.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../../components/ui/settings-row.tsx';
import {
    type DesktopUpdateStatus,
    useDesktopUpdate,
} from '../../../hooks/desktop/use-desktop-update.ts';
import { cn } from '../../../lib/utils.ts';

export function UpdatesSettings({ computerSettingsHref }: { computerSettingsHref?: string }) {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();
    const [hasCheckedForUpdate, setHasCheckedForUpdate] = React.useState(false);
    const canCheck = status.phase !== 'checking' && status.phase !== 'downloading';
    const canInstall = status.phase === 'available' || status.phase === 'ready';
    const updateStatusMessage = getUpdateStatusMessage(status, hasCheckedForUpdate);

    const handleCheckForUpdate = React.useCallback(async () => {
        await checkForUpdate();
        setHasCheckedForUpdate(true);
    }, [checkForUpdate]);

    return (
        <SettingsPage>
            <SettingsPageHeader title="Updates" />
            <SettingsSection title="Grotto Updates">
                <SettingsGroup>
                    <SettingsRow
                        className="md:items-start"
                        description="Check for and install updates to the packaged Grotto app."
                        title="Update"
                        trailingWidth="intrinsic"
                    >
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex shrink-0 items-center gap-2 md:justify-end">
                                <Button
                                    disabled={!canCheck}
                                    loading={status.phase === 'checking'}
                                    onClick={handleCheckForUpdate}
                                    variant="secondary"
                                >
                                    Check
                                </Button>
                                <Button
                                    disabled={!canInstall}
                                    loading={
                                        status.phase === 'downloading' ||
                                        status.phase === 'restarting'
                                    }
                                    onClick={updateAndRestart}
                                >
                                    <Icon icon={SystemUpdate01Icon} />
                                    {status.phase === 'ready' ? 'Restart' : 'Update'}
                                </Button>
                            </div>
                            {status.phase === 'downloading' ? (
                                <Progress value={status.progress * 100} />
                            ) : null}
                            {updateStatusMessage ? (
                                <UpdateStatusMessage {...updateStatusMessage} />
                            ) : null}
                        </div>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="App version">
                        <VersionValue>
                            {import.meta.env.VITE_GROTTO_PRODUCT_VERSION ?? 'Development'}
                        </VersionValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
            {computerSettingsHref ? (
                <SettingsSection title="Computer Updates">
                    <SettingsGroup>
                        <SettingsRow
                            description="Each attached Computer reports its own version and update state."
                            title="Grotto Computers"
                        >
                            <Button render={<Link to={computerSettingsHref} />} variant="secondary">
                                Manage Computers
                            </Button>
                        </SettingsRow>
                    </SettingsGroup>
                </SettingsSection>
            ) : null}
        </SettingsPage>
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
        <SettingsValue
            className={cn(
                'min-h-0 justify-start text-left font-medium md:justify-start md:text-left',
                tone === 'success' && 'text-success-foreground',
                tone === 'error' && 'text-error-foreground',
                tone === 'neutral' && 'text-muted-foreground'
            )}
        >
            {detail}
        </SettingsValue>
    );
}

function VersionValue({ children }: { children: React.ReactNode }) {
    return (
        <SettingsValue className="font-mono text-foreground tabular-nums">{children}</SettingsValue>
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
