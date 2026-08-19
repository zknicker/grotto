import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ComputerUsageCapacityView } from './computer-usage-capacity.tsx';

const usage = {
    capturedAt: '2026-08-14T15:00:00.000Z',
    claude: {
        error: {
            code: 'request' as const,
            message: 'Claude usage is unavailable.',
            name: 'UsageError',
        },
        provider: 'claude' as const,
        status: 'error' as const,
    },
    codex: {
        provider: 'codex' as const,
        snapshot: {
            capturedAt: '2026-08-14T15:00:00.000Z',
            creditsBalance: null,
            planType: 'pro',
            provider: 'codex' as const,
            source: 'chatgpt-wham-usage' as const,
            windows: [
                {
                    id: 'current-week' as const,
                    label: 'Current week',
                    remainingPercent: 87,
                    resetAfterSeconds: 3600,
                    resetsAt: '2026-08-14T16:00:00.000Z',
                    usedPercent: 13,
                },
            ],
        },
        status: 'ok' as const,
    },
    connectedProviders: ['openai-codex' as const],
    grok: {
        error: {
            code: 'request' as const,
            message: 'Grok usage is unavailable.',
            name: 'UsageError',
        },
        provider: 'grok' as const,
        status: 'error' as const,
    },
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
    runtimeUsage: [],
};

test('keeps a Computer plan snapshot visible while the Computer is offline', () => {
    const markup = renderToStaticMarkup(
        <ComputerUsageCapacityView
            computer={{
                architecture: 'arm64',
                computerId: 'cmp_test',
                health: 'offline',
                operatingSystem: 'darwin',
                productVersion: '1.4.4',
                reportedAt: '2026-08-14T15:00:00.000Z',
                usage,
            }}
            detectedRuntimeIds={['codex']}
        />
    );

    expect(markup).toContain('Codex');
    expect(markup).toContain('Weekly Limit');
    expect(markup).not.toContain('5h Limit');
    expect(markup).toContain('13%');
    expect(markup).not.toContain('Pi');
});

test('renders the sole Codex primary window as the weekly allowance', () => {
    const markup = renderToStaticMarkup(
        <ComputerUsageCapacityView
            computer={{
                architecture: 'arm64',
                computerId: 'cmp_test',
                health: 'healthy',
                operatingSystem: 'darwin',
                productVersion: '1.4.4',
                reportedAt: usage.capturedAt,
                usage: {
                    ...usage,
                    codex: {
                        ...usage.codex,
                        snapshot: {
                            ...usage.codex.snapshot,
                            windows: [
                                {
                                    id: 'current-session',
                                    label: 'Current session',
                                    remainingPercent: 83,
                                    resetAfterSeconds: 480_000,
                                    resetsAt: '2026-08-20T03:31:27.000Z',
                                    usedPercent: 17,
                                },
                            ],
                        },
                    },
                },
            }}
            detectedRuntimeIds={['codex']}
        />
    );

    expect(markup).toContain('Weekly Limit');
    expect(markup).toContain('17%');
    expect(markup).not.toContain('Plan limits unavailable');
});

test('renders only detected runtime cards without token details', () => {
    const markup = renderToStaticMarkup(
        <ComputerUsageCapacityView
            computer={{
                architecture: 'arm64',
                computerId: 'cmp_test',
                health: 'healthy',
                operatingSystem: 'darwin',
                productVersion: '1.4.4',
                reportedAt: '2026-08-14T15:00:00.000Z',
                usage: {
                    ...usage,
                    claude: {
                        provider: 'claude',
                        snapshot: {
                            capturedAt: usage.capturedAt,
                            extraUsage: null,
                            provider: 'claude',
                            source: 'anthropic-oauth-usage',
                            subscriptionType: 'max',
                            windows: [
                                {
                                    id: 'current-session',
                                    label: 'Current session',
                                    remainingPercent: 89,
                                    resetsAt: '2026-08-14T17:00:00.000Z',
                                    usedPercent: 11,
                                },
                                {
                                    id: 'current-week-all-models',
                                    label: 'Weekly Limit',
                                    remainingPercent: 72,
                                    resetsAt: null,
                                    usedPercent: 28,
                                },
                            ],
                        },
                        status: 'ok',
                    },
                    connectedProviders: ['claude-code', 'grok-build'],
                    grok: {
                        provider: 'grok',
                        snapshot: {
                            capturedAt: usage.capturedAt,
                            provider: 'grok',
                            source: 'grok-build-credits',
                            windows: [
                                {
                                    id: 'current-period',
                                    label: 'Weekly Limit',
                                    remainingPercent: 91,
                                    resetsAt: null,
                                    usedPercent: 9,
                                },
                            ],
                        },
                        status: 'ok',
                    },
                    runtimeUsage: [
                        runtimeTokens(
                            'claude-code',
                            'claude-code-jsonl',
                            'claude-opus-4-1',
                            120_000
                        ),
                        runtimeTokens('grok-build', 'grok-build-jsonl', 'grok-code-fast-1', 80_000),
                    ],
                },
            }}
            detectedRuntimeIds={['claude-code', 'grok-build']}
        />
    );

    expect(markup).toContain('Claude Code');
    expect(markup).toContain('Grok Build');
    expect(markup).not.toContain('Codex');
    expect(markup).not.toContain('Pi');
    expect(markup).toContain('Weekly Limit');
    // The burst window has its own column, so the chip carries only its value
    // and the meter column keeps one bar width across every row.
    expect(markup).toContain('5h limit');
    expect(markup).toContain('>11%<');
    expect(markup).toContain('tooltip__trigger flex');
    // Runtimes render through the same DataGrid as the Agents table on this
    // page, so both share one header, surface, and row treatment.
    expect(markup).toContain('data-slot="data-grid"');
    expect(markup).toContain('Weekly limit');
    expect(markup).toContain('Resets');
    // A weekly meter per runtime, plus a burst meter only where the runtime has
    // a 5-hour window; the runtime without one gets an inert track instead of a
    // zero-value bar that would announce "0%".
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3);
    expect(markup).toContain('No 5-hour limit');
    expect(markup).toContain('5-hour limit, 11% used.');
    expect(markup).not.toContain('auto-rows-fr');
    expect(markup).not.toContain('30-day processed tokens');
    expect(markup).not.toContain('claude-opus-4-1');
    expect(markup).not.toContain('grok-code-fast-1');
    expect(markup).not.toContain('OpenRouter');
});

test('represents Pi as a detected runtime with a filtered Agent usage link', () => {
    const markup = renderToStaticMarkup(
        <ComputerUsageCapacityView
            computer={{
                architecture: 'arm64',
                computerId: 'cmp_test',
                health: 'healthy',
                operatingSystem: 'darwin',
                productVersion: '1.4.4',
                reportedAt: usage.capturedAt,
                usage: {
                    ...usage,
                    connectedProviders: ['openrouter'],
                    openRouter: {
                        error: null,
                        overview: {
                            ...usage.openRouter.overview,
                            status: 'ready',
                        },
                        status: 'ok',
                    },
                },
            }}
            detectedRuntimeIds={['pi']}
            onViewPiUsage={() => undefined}
            piAgentCount={2}
        />
    );

    expect(markup).toContain('Pi');
    expect(markup).toContain('API-backed · 2 Agents');
    expect(markup).toContain('View usage');
    expect(markup).not.toContain('OpenRouter');
});

test('explains when a Computer has not reported usage', () => {
    const markup = renderToStaticMarkup(
        <ComputerUsageCapacityView
            computer={{
                architecture: 'arm64',
                computerId: 'cmp_test',
                health: 'healthy',
                operatingSystem: 'darwin',
                productVersion: '1.4.4',
                reportedAt: null,
                usage: null,
            }}
            detectedRuntimeIds={['codex']}
        />
    );

    expect(markup).toContain('Collecting usage');
    expect(markup).toContain('first usage report');
});

function runtimeTokens(
    runtimeId: 'claude-code' | 'grok-build',
    source: 'claude-code-jsonl' | 'grok-build-jsonl',
    modelId: string,
    totalTokens: number
) {
    const totals = {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: totalTokens - 1000,
        outputTokens: 1000,
        totalTokens,
    };
    return {
        runtimeId,
        snapshot: {
            capturedAt: usage.capturedAt,
            days: 30 as const,
            models: [{ modelId, ...totals }],
            runtimeId,
            source,
            totals,
        },
        status: 'ok' as const,
    };
}
