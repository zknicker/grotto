import { Button, ProgressBar } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    type DesktopUpdateStatus,
    useDesktopUpdate,
} from '../../../hooks/desktop/use-desktop-update.ts';
import { cn } from '../../../lib/utils.ts';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../layout/settings-page.tsx';

export function UpdatesSettings({ computerSettingsHref }: { computerSettingsHref?: string }) {
    const navigate = useNavigate();
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
                                    isDisabled={!canCheck}
                                    isPending={status.phase === 'checking'}
                                    onPress={handleCheckForUpdate}
                                    variant="secondary"
                                >
                                    Check
                                </Button>
                                <Button
                                    isDisabled={!canInstall}
                                    isPending={
                                        status.phase === 'downloading' ||
                                        status.phase === 'restarting'
                                    }
                                    onPress={updateAndRestart}
                                >
                                    {status.phase === 'ready' ? 'Restart' : 'Update'}
                                </Button>
                            </div>
                            {status.phase === 'downloading' ? (
                                <ProgressBar
                                    aria-label="Download progress"
                                    value={status.progress * 100}
                                >
                                    <ProgressBar.Track>
                                        <ProgressBar.Fill />
                                    </ProgressBar.Track>
                                </ProgressBar>
                            ) : null}
                            {updateStatusMessage ? (
                                <UpdateStatusMessage {...updateStatusMessage} />
                            ) : null}
                        </div>
                    </SettingsRow>
                    <SettingsRow title="App Version">
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
                            <Button
                                onPress={() => navigate(computerSettingsHref)}
                                variant="secondary"
                            >
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
                tone === 'success' && 'text-success',
                tone === 'error' && 'text-danger',
                tone === 'neutral' && 'text-muted'
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
