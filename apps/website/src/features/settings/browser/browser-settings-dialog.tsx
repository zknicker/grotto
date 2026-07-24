import { BrowserIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AgentRuntimeBrowserState } from '@tavern/api';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { FieldError } from '../../../components/ui/primitives/field.tsx';
import type { BrowserSettingsOutput } from '../../../lib/trpc.tsx';
import { type BrowserConfigField, BrowserConfigFields } from './browser-config-fields.tsx';
import { BrowserDialog, BrowserLockSwitch, BrowserNotice } from './browser-dialog.tsx';
import { BrowserSection, BrowserSectionStack } from './browser-service-fields.tsx';
import type { BrowserSettingsDraft } from './browser-settings-model.ts';

type BrowserSettings = NonNullable<BrowserSettingsOutput>;

export function BrowserSettingsDialog({
    canSave,
    draft,
    error,
    isSaving,
    onDraftChange,
    onOpenBrowser,
    onOpenChange,
    onRestartBrowser,
    onSave,
    open,
    setupError,
    settings,
}: {
    canSave: boolean;
    draft: BrowserSettingsDraft;
    error?: string | null;
    isSaving: boolean;
    onDraftChange: Dispatch<SetStateAction<BrowserSettingsDraft>>;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onOpenChange: (open: boolean) => void;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onSave: () => void;
    open: boolean;
    setupError?: string | null;
    settings: BrowserSettings;
}) {
    const browserFields = createBrowserFields({ setupError });

    return (
        <BrowserDialog
            description="Let agents use a managed Chrome profile for browser automation."
            footer={
                <Button
                    className="ml-auto"
                    disabled={!canSave || isSaving}
                    loading={isSaving}
                    type="submit"
                >
                    Save
                </Button>
            }
            headerAction={
                <BrowserLockSwitch
                    aria-label={`${draft.enabled ? 'Disable' : 'Enable'} Browser`}
                    checked={draft.enabled}
                    disabled={isSaving}
                    locked={false}
                    onCheckedChange={(enabled) =>
                        onDraftChange((current) => ({ ...current, enabled }))
                    }
                />
            }
            icon={BrowserIcon}
            onOpenChange={onOpenChange}
            onSubmit={() => {
                if (canSave) {
                    onSave();
                }
            }}
            open={open}
            title="Browser"
            titleSuffix="Tool"
        >
            <BrowserSectionStack>
                <BrowserSection
                    description="Choose a durable, signed-in browser identity for this tool."
                    title="Profile"
                >
                    <BrowserConfigFields
                        disabled={isSaving}
                        draft={draft}
                        fields={[browserFields.profileName]}
                        onDraftChange={onDraftChange}
                    />

                    {settings.skillConflict ? (
                        <BrowserNotice title="Skill conflict">
                            Existing skill at{' '}
                            <span className="font-mono">{settings.skillConflict.skillPath}</span>.
                            Enabling Browser will replace it after confirmation.
                        </BrowserNotice>
                    ) : null}
                </BrowserSection>

                <BrowserSection
                    description="The Chrome install Grotto manages."
                    title="Managed Chrome"
                >
                    {settings.application ? (
                        <BrowserNotice title="Detected">
                            <span className="font-mono">{settings.application.path}</span>
                            {settings.application.version
                                ? ` (${settings.application.version})`
                                : null}
                        </BrowserNotice>
                    ) : (
                        <BrowserNotice title="Not installed" variant="error">
                            Install Google Chrome to enable Browser.
                        </BrowserNotice>
                    )}
                </BrowserSection>

                <BrowserSection
                    action={
                        settings.enabled ? (
                            <>
                                <Button
                                    disabled={isSaving}
                                    onClick={() => {
                                        void onOpenBrowser()?.catch(() => undefined);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Open Browser
                                </Button>
                                <Button
                                    disabled={isSaving}
                                    onClick={() => {
                                        void onRestartBrowser()?.catch(() => undefined);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    Restart Browser
                                </Button>
                            </>
                        ) : null
                    }
                    description="Current health of the managed browser process."
                    title="Status"
                >
                    <BrowserStatusNotice settings={settings} />
                </BrowserSection>
            </BrowserSectionStack>

            {error ? <FieldError>{error}</FieldError> : null}
        </BrowserDialog>
    );
}

function BrowserStatusNotice({ settings }: { settings: BrowserSettings }) {
    if (!settings.status) {
        return <p className="text-muted-foreground text-sm">Browser has not started yet.</p>;
    }

    const { reason, state } = settings.status;

    return (
        <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{formatBrowserState(state)}</span>
            {reason ? ` — ${reason}` : ''}
        </p>
    );
}

function formatBrowserState(state: AgentRuntimeBrowserState) {
    switch (state) {
        case 'degraded':
            return 'Degraded';
        case 'healthy':
            return 'Healthy';
        case 'pressured':
            return 'Under pressure';
        case 'recovering':
            return 'Recovering';
        case 'starting':
            return 'Starting';
        case 'stopped':
            return 'Stopped';
        case 'unresponsive':
            return 'Unresponsive';
        default:
            return state;
    }
}

function createBrowserFields({ setupError }: { setupError?: string | null }) {
    return {
        profileName: {
            ariaLabel: 'Browser profile name',
            description:
                'Lowercase letters, digits, hyphens. Changing it switches to a separate browser identity without deleting the old profile.',
            error: setupError,
            id: 'browser-profile-name',
            kind: 'text',
            label: 'Profile name',
            monospace: true,
            placeholder: 'default',
            read: (draft) => draft.profileName,
            write: (draft, profileName) => ({ ...draft, profileName }),
        },
    } satisfies Record<string, BrowserConfigField<BrowserSettingsDraft>>;
}
