import type { AgentRuntimeBrowserSettings, AgentRuntimeSaveBrowserSettings } from '@grotto/api';
import { Button, Chip } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import { BrowserIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { BrowserEnablementSwitch } from './browser-enablement-switch.tsx';
import {
    BrowserDisableConfirmationDialog,
    BrowserSkillConflictConfirmationDialog,
} from './browser-settings-confirmation-dialogs.tsx';
import { BrowserSettingsDialog } from './browser-settings-dialog.tsx';
import {
    type BrowserSettingsDraft,
    createDraft,
    hasDraftChanges,
    normalizeDraft,
    toSaveInput,
} from './browser-settings-model.ts';

type BrowserSettings = AgentRuntimeBrowserSettings;
type BrowserSettingsControlRender = (control: {
    openSettingsDialog: (nextDraft?: Partial<BrowserSettingsDraft>) => void;
    requestSave: (input: AgentRuntimeSaveBrowserSettings) => void;
}) => React.ReactNode;

export function BrowserSettingsCard({
    error,
    isLoading = false,
    isSaving = false,
    onOpenBrowser,
    onRestartBrowser,
    onSave,
    settings,
}: {
    error?: string | null;
    isLoading?: boolean;
    isSaving?: boolean;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onSave: (input: AgentRuntimeSaveBrowserSettings) => Promise<unknown> | undefined;
    settings: BrowserSettings | null;
}) {
    if (isLoading) {
        return <BrowserSkeleton />;
    }

    if (!settings) {
        return (
            <ItemCard>
                <ItemCard.Content>
                    <ItemCard.Title>Browser</ItemCard.Title>
                    <ItemCard.Description>
                        {error ?? 'Grotto Computer unavailable.'}
                    </ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                    <Button isDisabled size="sm" variant="secondary">
                        Configure
                    </Button>
                </ItemCard.Action>
            </ItemCard>
        );
    }

    const currentSettings = settings;

    return (
        <BrowserSettingsControl
            error={error}
            isSaving={isSaving}
            onOpenBrowser={onOpenBrowser}
            onRestartBrowser={onRestartBrowser}
            onSave={onSave}
            settings={currentSettings}
        >
            {({ openSettingsDialog, requestSave }) => (
                <BrowserRow
                    isSaving={isSaving}
                    onEnabledChange={(enabled) => requestSave({ enabled })}
                    onSelect={openSettingsDialog}
                    settings={currentSettings}
                />
            )}
        </BrowserSettingsControl>
    );
}

export function BrowserSettingsControl({
    children,
    error,
    isSaving,
    onOpenBrowser,
    onRestartBrowser,
    onSave,
    settings,
}: {
    children: BrowserSettingsControlRender;
    error?: string | null;
    isSaving: boolean;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onSave: (input: AgentRuntimeSaveBrowserSettings) => Promise<unknown> | undefined;
    settings: BrowserSettings;
}) {
    const [draft, setDraft] = React.useState<BrowserSettingsDraft>(() => createDraft(settings));
    const [disableDialogOpen, setDisableDialogOpen] = React.useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = React.useState(false);
    const [pendingSave, setPendingSave] = React.useState<AgentRuntimeSaveBrowserSettings | null>(
        null
    );

    React.useEffect(() => {
        setDraft(createDraft(settings));
        setDisableDialogOpen(false);
        setPendingSave(null);
        setReplaceDialogOpen(false);
    }, [settings]);

    const currentSettings = settings;
    const normalized = normalizeDraft(draft);
    const hasChanges = hasDraftChanges(currentSettings, normalized);
    const needsReplaceConfirmation = Boolean(currentSettings.skillConflict && normalized.enabled);
    const missingProfileName = normalized.profileName.length === 0;
    const canSave = !missingProfileName && (hasChanges || needsReplaceConfirmation);
    const setupError = missingProfileName ? 'Set a profile name before saving.' : null;

    function openSettingsDialog(nextDraft?: Partial<BrowserSettingsDraft>) {
        setDraft({ ...createDraft(currentSettings), ...nextDraft });
        setPendingSave(null);
        setReplaceDialogOpen(false);
        setSettingsDialogOpen(true);
    }

    function requestSave(input: AgentRuntimeSaveBrowserSettings) {
        if (
            currentSettings.enabled &&
            input.enabled === false &&
            currentSettings.affectedAgents.length > 0
        ) {
            setPendingSave(input);
            setDisableDialogOpen(true);
            return;
        }
        if (currentSettings.skillConflict && input.enabled === true) {
            setPendingSave(input);
            setReplaceDialogOpen(true);
            return;
        }
        void onSave(input);
    }

    return (
        <>
            {children({ openSettingsDialog, requestSave })}

            <BrowserSettingsDialog
                canSave={canSave}
                draft={draft}
                error={error}
                isSaving={isSaving}
                onDraftChange={setDraft}
                onOpenBrowser={onOpenBrowser}
                onOpenChange={setSettingsDialogOpen}
                onRestartBrowser={onRestartBrowser}
                onSave={() => requestSave(toSaveInput(currentSettings, normalized))}
                open={settingsDialogOpen}
                settings={currentSettings}
                setupError={setupError}
            />

            <BrowserSkillConflictConfirmationDialog
                isSaving={isSaving}
                onCancel={() => setReplaceDialogOpen(false)}
                onOpenChange={setReplaceDialogOpen}
                onReplace={() => {
                    if (!pendingSave) {
                        return;
                    }
                    void onSave(pendingSave);
                    setPendingSave(null);
                    setReplaceDialogOpen(false);
                }}
                open={replaceDialogOpen}
            />

            <BrowserDisableConfirmationDialog
                affectedAgentNames={currentSettings.affectedAgents.map((agent) => agent.name)}
                onConfirm={() => {
                    if (pendingSave) {
                        void onSave(pendingSave);
                    }
                    setPendingSave(null);
                }}
                onOpenChange={setDisableDialogOpen}
                open={disableDialogOpen}
            />
        </>
    );
}

function BrowserRow({
    isSaving,
    onEnabledChange,
    onSelect,
    settings,
}: {
    isSaving: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onSelect: () => void;
    settings: BrowserSettings;
}) {
    return (
        <ItemCard>
            <ItemCard.Icon>
                <Icon icon={BrowserIcon} />
            </ItemCard.Icon>
            <ItemCard.Content>
                <ItemCard.Title>
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">Browser</span>
                        {settings.skillConflict ? (
                            <Chip color="warning" size="sm" variant="soft">
                                Skill Conflict
                            </Chip>
                        ) : null}
                    </span>
                </ItemCard.Title>
                <ItemCard.Description>
                    Let agents use a managed Chrome profile for browser automation.
                </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
                <div className="flex items-center gap-2">
                    <Button isDisabled={isSaving} onPress={onSelect} size="sm" variant="secondary">
                        Configure
                    </Button>
                    <BrowserEnablementSwitch
                        aria-label={`${settings.enabled ? 'Disable' : 'Enable'} Browser`}
                        checked={settings.enabled}
                        disabled={isSaving}
                        lockReason={null}
                        onCheckedChange={onEnabledChange}
                    />
                </div>
            </ItemCard.Action>
        </ItemCard>
    );
}

/** Blank while loading — the app shows no skeletons on synced surfaces. */
function BrowserSkeleton() {
    return (
        <div aria-busy="true" className="min-h-14">
            <span className="sr-only">Loading Browser settings</span>
        </div>
    );
}
