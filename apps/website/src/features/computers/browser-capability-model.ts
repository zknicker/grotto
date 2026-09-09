import type { AgentRuntimeBrowserSettings, AgentRuntimeBrowserState } from '@grotto/api';

export type BrowserCapabilityStatus =
    | 'attention'
    | 'not-configured'
    | 'not-running'
    | 'off'
    | 'ready'
    | 'starting'
    | 'unavailable';

export interface BrowserCapabilityView {
    canConfigure: boolean;
    canDisable: boolean;
    canEnable: boolean;
    canOpen: boolean;
    canRestart: boolean;
    description: string;
    status: BrowserCapabilityStatus;
    statusLabel: string;
}

export function browserCapabilityView(input: {
    error?: string | null;
    settings: AgentRuntimeBrowserSettings | null;
}): BrowserCapabilityView {
    const { error, settings } = input;

    if (!settings) {
        return unavailableView(error ?? 'Reconnect this Computer to manage its Browser.');
    }

    const hasChrome = settings.application !== null;
    const canConfigure = settings.configured || hasChrome;
    const actions = {
        canConfigure,
        canDisable: settings.configured && settings.enabled,
        canEnable: settings.configured && hasChrome && !settings.enabled,
        canOpen: settings.configured && hasChrome && settings.enabled,
        canRestart: settings.configured && hasChrome && settings.enabled,
    };

    if (!hasChrome) {
        return {
            ...actions,
            description: settings.configured
                ? `${profileDescription(settings)} Google Chrome was not detected on this Computer. Browser currently supports Google Chrome on macOS.`
                : 'Google Chrome was not detected on this Computer. Browser currently supports Google Chrome on macOS.',
            status: 'unavailable',
            statusLabel: 'Unavailable',
        };
    }

    if (!settings.configured) {
        return {
            ...actions,
            description:
                'Google Chrome is available on this Computer. Configure a shared profile for Agents assigned here.',
            status: 'not-configured',
            statusLabel: 'Not configured',
        };
    }

    if (!settings.enabled) {
        return {
            ...actions,
            description: `${profileDescription(settings)} Browser is off.`,
            status: 'off',
            statusLabel: 'Off',
        };
    }

    if (!settings.status) {
        return {
            ...actions,
            description: `${profileDescription(settings)} Browser is enabled but not running.`,
            status: 'not-running',
            statusLabel: 'Not running',
        };
    }

    return {
        ...actions,
        description: descriptionForStatus(settings, settings.status.state),
        status: capabilityStatus(settings.status.state),
        statusLabel: statusLabel(settings.status.state),
    };
}

function unavailableView(description: string): BrowserCapabilityView {
    return {
        canConfigure: false,
        canDisable: false,
        canEnable: false,
        canOpen: false,
        canRestart: false,
        description,
        status: 'unavailable',
        statusLabel: 'Unavailable',
    };
}

function profileDescription(settings: AgentRuntimeBrowserSettings) {
    return `Grotto manages Chrome with the “${settings.profileName}” profile. Agents on this Computer share its signed-in accounts.`;
}

function descriptionForStatus(
    settings: AgentRuntimeBrowserSettings,
    state: AgentRuntimeBrowserState
) {
    const profile = profileDescription(settings);
    switch (state) {
        case 'healthy':
            return `${profile} Turning Browser off closes the managed browser and may interrupt Agents.`;
        case 'starting':
            return `${profile} Chrome is starting for Agents on this Computer.`;
        case 'recovering':
            return `${profile} Chrome is recovering after an interruption.`;
        case 'pressured':
            return `${profile} Chrome is under resource pressure.`;
        case 'unresponsive':
            return `${profile} Chrome is not responding.`;
        case 'degraded':
            return `${profile} Browser needs attention.`;
        case 'stopped':
            return `${profile} Browser is not running.`;
    }
}

function capabilityStatus(state: AgentRuntimeBrowserState): BrowserCapabilityStatus {
    switch (state) {
        case 'healthy':
            return 'ready';
        case 'starting':
        case 'recovering':
            return 'starting';
        case 'stopped':
            return 'not-running';
        case 'degraded':
        case 'pressured':
        case 'unresponsive':
            return 'attention';
    }
}

function statusLabel(state: AgentRuntimeBrowserState) {
    switch (state) {
        case 'healthy':
            return 'Ready';
        case 'starting':
            return 'Starting';
        case 'recovering':
            return 'Recovering';
        case 'stopped':
            return 'Not running';
        case 'degraded':
            return 'Needs attention';
        case 'pressured':
            return 'Under pressure';
        case 'unresponsive':
            return 'Unresponsive';
    }
}
