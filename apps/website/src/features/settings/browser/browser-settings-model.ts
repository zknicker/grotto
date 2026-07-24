import type { AgentRuntimeSaveBrowserSettings } from '@tavern/api';
import type { BrowserSettingsOutput } from '../../../lib/trpc.tsx';

type BrowserSettings = NonNullable<BrowserSettingsOutput>;

export interface BrowserSettingsDraft {
    enabled: boolean;
    profileName: string;
}

export function createDraft(settings: BrowserSettings | null): BrowserSettingsDraft {
    return {
        enabled: settings?.enabled ?? false,
        profileName: settings?.profileName ?? '',
    };
}

export function normalizeDraft(draft: BrowserSettingsDraft): BrowserSettingsDraft {
    return {
        enabled: draft.enabled,
        profileName: draft.profileName.trim(),
    };
}

export function toSaveInput(
    _settings: BrowserSettings,
    draft: BrowserSettingsDraft
): AgentRuntimeSaveBrowserSettings {
    return {
        enabled: draft.enabled,
        profileName: draft.profileName,
    };
}

export function hasDraftChanges(settings: BrowserSettings, draft: BrowserSettingsDraft) {
    return draft.enabled !== settings.enabled || draft.profileName !== settings.profileName;
}
