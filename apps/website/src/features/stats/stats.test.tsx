import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Stats } from './stats.tsx';

const usage = {
    capturedAt: '2026-07-28T20:00:00.000Z',
    codex: {
        provider: 'codex' as const,
        snapshot: {
            capturedAt: '2026-07-28T20:00:00.000Z',
            creditsBalance: null,
            planType: 'pro',
            provider: 'codex' as const,
            source: 'chatgpt-wham-usage' as const,
            windows: [
                {
                    id: 'current-session' as const,
                    label: 'Current session',
                    remainingPercent: 75,
                    resetAfterSeconds: 3600,
                    resetsAt: '2026-07-28T21:00:00.000Z',
                    usedPercent: 25,
                },
                {
                    id: 'current-week' as const,
                    label: 'Current week',
                    remainingPercent: 60,
                    resetAfterSeconds: 86_400,
                    resetsAt: '2026-07-29T20:00:00.000Z',
                    usedPercent: 40,
                },
            ],
        },
        status: 'ok' as const,
    },
    connectedProviders: ['openai-codex' as const],
    openRouter: {
        error: null,
        overview: {
            days: 30,
            keys: [],
            message: null,
            note: null,
            series: [],
            status: 'unconfigured' as const,
            totalByokUsageUsd: 0,
            totalRequests: 0,
            totalUsageUsd: 0,
        },
        status: 'ok' as const,
    },
};

test('Stats renders every Computer and keeps offline snapshots visible', () => {
    const markup = renderToStaticMarkup(
        <Stats
            computers={[
                {
                    architecture: 'arm64',
                    computerId: 'cmp_1234567890123456',
                    health: 'offline',
                    operatingSystem: 'darwin',
                    productVersion: '1.1.0',
                    reportedAt: '2026-07-28T20:00:01.000Z',
                    usage,
                },
                {
                    architecture: 'arm64',
                    computerId: 'cmp_6543210987654321',
                    health: 'healthy',
                    operatingSystem: 'darwin',
                    productVersion: '1.1.0',
                    reportedAt: null,
                    usage: null,
                },
            ]}
        />
    );

    expect(markup).toContain('Computer · 123456');
    expect(markup).toContain('Computer · 654321');
    expect(markup).toContain('Codex');
    expect(markup).toContain('5h Limit');
    expect(markup).toContain('25%');
    expect(markup).toContain('Usage not reported');
    expect(markup).toContain('Collecting');
});

test('Stats distinguishes query failure from an empty Server', () => {
    const failed = renderToStaticMarkup(
        <Stats
            computers={undefined}
            status={{ detail: 'Server unavailable', title: 'Stats unavailable' }}
        />
    );
    const empty = renderToStaticMarkup(<Stats computers={[]} />);

    expect(failed).toContain('Stats unavailable');
    expect(failed).toContain('Server unavailable');
    expect(empty).toContain('No Computers');
    expect(empty).toContain('Waiting for a Computer');
});

test('Stats keeps cached usage visible during a failed refresh', () => {
    const markup = renderToStaticMarkup(
        <Stats
            computers={[
                {
                    architecture: 'arm64',
                    computerId: 'cmp_1234567890123456',
                    health: 'offline',
                    operatingSystem: 'darwin',
                    productVersion: '1.1.0',
                    reportedAt: '2026-07-28T20:00:01.000Z',
                    usage: {
                        ...usage,
                        connectedProviders: ['openai-codex'],
                        openRouter: {
                            error: {
                                code: 'request',
                                message: 'OpenRouter usage is unavailable on this Computer.',
                                name: 'UsageError',
                            },
                            overview: {
                                ...usage.openRouter.overview,
                                message: 'OpenRouter usage is unavailable.',
                                status: 'empty',
                            },
                            status: 'error',
                        },
                    },
                },
            ]}
            refreshError="Server unavailable"
        />
    );

    expect(markup).toContain('Stats refresh failed');
    expect(markup).toContain('Showing last report');
    expect(markup).toContain('Codex');
    expect(markup).toContain('OpenRouter');
    expect(markup).toContain('OpenRouter usage is unavailable on this Computer.');
});
