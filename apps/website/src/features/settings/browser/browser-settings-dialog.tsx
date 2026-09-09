import type { AgentRuntimeBrowserSettings, AgentRuntimeBrowserState } from '@grotto/api';
import { Alert, Button } from '@heroui/react';
import { BrowserIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { Dispatch, SetStateAction } from 'react';
import { type BrowserConfigField, BrowserConfigFields } from './browser-config-fields.tsx';
import {
    BROWSER_DIALOG_FORM_ID,
    BrowserDialog,
    BrowserLockSwitch,
    BrowserNotice,
} from './browser-dialog.tsx';
import { BrowserSection, BrowserSectionStack } from './browser-service-fields.tsx';
import type { BrowserSettingsDraft } from './browser-settings-model.ts';

type BrowserSettings = AgentRuntimeBrowserSettings;

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
            description="Grotto manages Google Chrome on this Computer with one shared profile. The profile name selects the local identity; it does not install Chrome or create an account."
            footer={
                <Button
                    form={BROWSER_DIALOG_FORM_ID}
                    isDisabled={!canSave || isSaving}
                    isPending={isSaving}
                    type="submit"
                >
                    {settings.configured ? 'Save' : 'Set up Browser'}
                </Button>
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
                    action={
                        <BrowserLockSwitch
                            aria-label={`${draft.enabled ? 'Disable' : 'Enable'} Browser`}
                            checked={draft.enabled}
                            disabled={isSaving}
                            locked={!(settings.application || draft.enabled)}
                            lockTooltip="Install Google Chrome on this Computer before enabling Browser."
                            onCheckedChange={(enabled) =>
                                onDraftChange((current) => ({ ...current, enabled }))
                            }
                        />
                    }
                    description="Turning off Browser closes the managed browser and may interrupt Agents using it."
                    title="Enable Browser"
                />
                <BrowserSection
                    description="This durable Chrome profile keeps the cookies and signed-in accounts shared by Agents on this Computer."
                    title="Profile"
                >
                    <BrowserConfigFields
                        disabled={isSaving}
                        draft={draft}
                        fields={[browserFields.profileName]}
                        onDraftChange={onDraftChange}
                    />
                </BrowserSection>

                <BrowserSection
                    description="The Chrome install Grotto manages."
                    title="Chrome installation"
                >
                    {settings.application ? (
                        <BrowserNotice title="Detected">
                            <span className="font-mono">{settings.application.path}</span>
                            {settings.application.version
                                ? ` (${settings.application.version})`
                                : null}
                        </BrowserNotice>
                    ) : (
                        <BrowserNotice title="Not detected">
                            Google Chrome was not detected on this Computer. Browser currently
                            supports Google Chrome on macOS.
                        </BrowserNotice>
                    )}
                </BrowserSection>

                <BrowserSection
                    action={
                        settings.enabled ? (
                            <>
                                <Button
                                    isDisabled={isSaving}
                                    onPress={() => {
                                        void onOpenBrowser()?.catch(() => undefined);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                >
                                    Open Browser
                                </Button>
                                <Button
                                    isDisabled={isSaving}
                                    onPress={() => {
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

            {error ? (
                <Alert status="danger">
                    <Alert.Content>
                        <Alert.Title>Browser Update Failed</Alert.Title>
                        <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}
        </BrowserDialog>
    );
}

function BrowserStatusNotice({ settings }: { settings: BrowserSettings }) {
    if (!settings.status) {
        return <p className="text-muted text-sm">Browser has not started yet.</p>;
    }

    const { reason, state } = settings.status;

    return (
        <p className="text-muted text-sm">
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
            label: 'Profile Name',
            monospace: true,
            placeholder: 'default',
            read: (draft) => draft.profileName,
            write: (draft, profileName) => ({ ...draft, profileName }),
        },
    } satisfies Record<string, BrowserConfigField<BrowserSettingsDraft>>;
}
