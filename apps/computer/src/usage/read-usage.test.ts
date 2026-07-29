import { expect, test } from 'bun:test';
import { readComputerUsage } from './read-usage.ts';

test('Computer reports only provider usage sources it can actually read', async () => {
    const usage = await readComputerUsage({
        loadCodexUsage: async () => ({
            capturedAt: '2026-07-28T20:00:00.000Z',
            creditsBalance: null,
            planType: 'pro',
            provider: 'codex',
            source: 'chatgpt-wham-usage',
            windows: [],
        }),
        loadOpenRouterUsage: async () => ({
            days: 30,
            keys: [{ id: 'openai/gpt', label: 'openai/gpt', providerName: 'OpenAI' }],
            message: null,
            note: null,
            series: [],
            status: 'ready',
            totalByokUsageUsd: 0,
            totalRequests: 1,
            totalUsageUsd: 0.1,
        }),
        now: () => new Date('2026-07-28T20:00:00.000Z'),
    });

    expect(usage.codex.status).toBe('ok');
    expect(usage.connectedProviders).toEqual(['openai-codex', 'openrouter']);
});

test('Computer does not claim Codex is connected after an auth/read failure', async () => {
    const usage = await readComputerUsage({
        loadCodexUsage: async () => {
            throw new Error('No Codex session');
        },
        loadOpenRouterUsage: async () => ({
            days: 30,
            keys: [],
            message: 'Not configured',
            note: null,
            series: [],
            status: 'unconfigured',
            totalByokUsageUsd: 0,
            totalRequests: 0,
            totalUsageUsd: 0,
        }),
    });

    expect(usage.codex.status).toBe('error');
    expect(usage.codex).toMatchObject({
        error: {
            message: 'Codex usage is unavailable on this Computer.',
            name: 'UsageError',
        },
    });
    expect(JSON.stringify(usage)).not.toContain('No Codex session');
    expect(usage.connectedProviders).toEqual([]);
});

test('Computer does not claim OpenRouter is connected after a request failure', async () => {
    const usage = await readComputerUsage({
        loadCodexUsage: async () => {
            throw new Error('No Codex session');
        },
        loadOpenRouterUsage: async () => {
            throw new Error('OpenRouter unavailable');
        },
    });

    expect(usage.openRouter.status).toBe('error');
    expect(usage.openRouter.error).toMatchObject({
        message: 'OpenRouter usage is unavailable on this Computer.',
        name: 'UsageError',
    });
    expect(JSON.stringify(usage)).not.toContain('OpenRouter unavailable');
    expect(usage.connectedProviders).toEqual([]);
});
