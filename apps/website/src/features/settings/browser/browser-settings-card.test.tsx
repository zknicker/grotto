import { expect, test } from 'bun:test';
import type { AgentRuntimeBrowserSettings } from '@haus/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrowserSettingsCard } from './browser-settings-card.tsx';

const settings = {
    application: { path: '/Applications/Google Chrome.app', version: '128.0.0.0' },
    configured: true,
    enabled: true,
    profileName: 'default',
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
    updatedAt: null,
} satisfies AgentRuntimeBrowserSettings;

test('explains shared Browser ownership and renders disable as an ordinary operation', () => {
    const html = renderToStaticMarkup(
        <BrowserSettingsCard
            onOpenBrowser={() => undefined}
            onRestartBrowser={() => undefined}
            onSave={() => undefined}
            settings={settings}
        />
    );

    expect(html).toContain('Chrome');
    expect(html).not.toContain('Managed Chrome');
    expect(html).toContain('Ready');
    expect(html).toContain('Haus manages Chrome with the “default” profile.');
    expect(html).toContain(
        'Turning Browser off closes the managed browser and may interrupt Agents.'
    );
    expect(html).toContain('aria-label="Chrome actions"');
    expect(html).not.toContain('Disable Browser?');
    expect(html).not.toContain('Skill Conflict');
});
