import type { GrottoAgentState } from '@grotto/api';

export interface GrottoAgentVersionView {
    color: 'accent' | 'danger';
    detail: string;
    version: string;
}

export function grottoAgentVersionView(state: GrottoAgentState): GrottoAgentVersionView {
    if (state.status === 'current') {
        return {
            color: 'accent',
            detail: 'Up to date',
            version: `v${state.appliedVersion ?? state.currentVersion}`,
        };
    }

    const version = state.appliedVersion
        ? `v${state.appliedVersion} → v${state.currentVersion}`
        : `Not applied → v${state.currentVersion}`;
    return { color: 'danger', detail: 'Out of date', version };
}
