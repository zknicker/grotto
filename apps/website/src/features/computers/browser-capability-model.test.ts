import { expect, test } from 'bun:test';
import type { AgentRuntimeBrowserSettings } from '@grotto/api';
import { browserCapabilityView } from './browser-capability-model.ts';

const baseSettings = {
    application: { path: '/Applications/Google Chrome.app', version: '128.0.0.0' },
    configured: true,
    enabled: true,
    profileName: 'default',
    status: null,
    updatedAt: '2026-09-09T16:00:00.000Z',
} satisfies AgentRuntimeBrowserSettings;

test('shows Chrome as available but not configured before the first save', () => {
    const view = browserCapabilityView({
        settings: { ...baseSettings, configured: false, enabled: false, updatedAt: null },
    });

    expect(view).toMatchObject({
        canConfigure: true,
        canEnable: false,
        status: 'not-configured',
        statusLabel: 'Not configured',
    });
    expect(view.description).toContain('Google Chrome is available');
});

test('only reports Ready when configured Browser health is observed', () => {
    const view = browserCapabilityView({
        settings: {
            ...baseSettings,
            status: {
                browserVersion: '128.0.0.0',
                cdpState: 'healthy',
                checkedAt: '2026-09-09T16:00:00.000Z',
                pid: 123,
                pressureSince: null,
                reason: null,
                resources: {
                    browserCpuPercent: 2,
                    browserRssBytes: 100,
                    gpuCpuPercent: 1,
                    gpuRssBytes: 50,
                },
                restartBudget: { automaticRestartLimit: 3, automaticRestartsInWindow: 0 },
                running: true,
                state: 'healthy',
                uptimeSeconds: 60,
            },
        },
    });

    expect(view).toMatchObject({
        canDisable: true,
        canOpen: true,
        canRestart: true,
        status: 'ready',
        statusLabel: 'Ready',
    });
});

test('separates a saved but disabled Browser from initial setup', () => {
    const view = browserCapabilityView({
        settings: { ...baseSettings, enabled: false },
    });

    expect(view).toMatchObject({
        canConfigure: true,
        canEnable: true,
        canOpen: false,
        status: 'off',
        statusLabel: 'Off',
    });
});

test('does not offer setup when Chrome is unavailable', () => {
    const view = browserCapabilityView({
        settings: { ...baseSettings, application: null, configured: false, enabled: false },
    });

    expect(view).toMatchObject({
        canConfigure: false,
        canEnable: false,
        status: 'unavailable',
        statusLabel: 'Unavailable',
    });
    expect(view.description).toContain('was not detected');
});
