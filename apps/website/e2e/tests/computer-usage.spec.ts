import type { UsageOverview } from '@grotto/api';
import { sendBootstrap, socketMessage, socketOpen } from '../support/computer-socket.ts';
import { attachComputer, createTestServer } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

test('old provider usage stays labeled until a fresh Computer snapshot arrives', async ({
    page,
}) => {
    test.setTimeout(60_000);
    const { client: owner } = await createTestServer(page, {
        displayName: 'Usage HQ',
        slug: 'usage-hq',
    });
    const credential = 'computer-usage-test-credential-1234';
    await attachComputer(owner, { credential, slug: 'usage-hq' });
    const computer = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    try {
        await socketOpen(computer);
        const accepted = socketMessage(computer);
        sendBootstrap(computer, credential, 'complete');
        expect(await accepted).toMatchObject({ mode: 'ordinary' });
        computer.send(
            JSON.stringify({
                agents: [],
                inventory: {
                    name: 'Mac Computer',
                    runtimes: [{ id: 'claude-code', label: 'Claude Code', models: [] }],
                },
                type: 'report',
            })
        );
        computer.send(
            JSON.stringify({ type: 'usage-report', usage: planUsage('2026-08-19T04:08:16.193Z') })
        );
        await page.goto('/s/usage-hq/computers');
        const rows = page.getByRole('grid', { name: 'Runtimes on this Computer' });
        await expect(rows.getByText('Usage out of date')).toBeVisible({ timeout: 20_000 });
        await expect(rows.getByText(/Last updated/)).toBeVisible();
        await expect(rows.getByText('22%', { exact: true })).toBeVisible();
        await expect(rows.getByText(/^Resets /)).toHaveCount(0);
        computer.send(
            JSON.stringify({ type: 'usage-report', usage: planUsage(new Date().toISOString()) })
        );
        await expect(rows.getByText('Usage out of date')).toHaveCount(0);
        await expect(rows.getByText(/^Resets /)).toBeVisible();
    } finally {
        computer.close();
    }
});

function planUsage(capturedAt: string): UsageOverview {
    const unavailable = { code: 'request' as const, message: 'Unavailable', name: 'UsageError' };
    return {
        capturedAt: new Date().toISOString(),
        claude: {
            provider: 'claude',
            status: 'ok',
            snapshot: {
                capturedAt,
                extraUsage: null,
                provider: 'claude',
                source: 'anthropic-oauth-usage',
                subscriptionType: 'max',
                windows: [
                    {
                        id: 'current-week-all-models',
                        label: 'Weekly Limit',
                        remainingPercent: 78,
                        resetsAt: new Date(Date.parse(capturedAt) + 7 * 86_400_000).toISOString(),
                        usedPercent: 22,
                    },
                ],
            },
        },
        codex: { provider: 'codex', status: 'error', error: unavailable },
        connectedProviders: ['claude-code'],
        grok: { provider: 'grok', status: 'error', error: unavailable },
        openRouter: {
            error: null,
            overview: {
                days: 0,
                keys: [],
                message: null,
                note: null,
                series: [],
                status: 'unconfigured',
                totalByokUsageUsd: 0,
                totalRequests: 0,
                totalUsageUsd: 0,
            },
            status: 'ok',
        },
        runtimeUsage: [],
    };
}
