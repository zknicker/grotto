import { expect, test } from 'bun:test';
import { serverUsageOverviewSchema, usageReportSchema } from './stats.ts';

const usage = {
    capturedAt: '2026-07-28T20:00:00.000Z',
    codex: {
        error: { code: 'request' as const, message: 'offline', name: 'Error' },
        provider: 'codex' as const,
        status: 'error' as const,
    },
    connectedProviders: [],
    openRouter: {
        error: null,
        overview: {
            days: 0,
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

test('Computer usage reports carry one validated snapshot', () => {
    expect(
        usageReportSchema.parse({
            type: 'usage-report',
            usage,
        })
    ).toEqual({ type: 'usage-report', usage });
});

test('Server usage reads keep every Computer and its latest durable snapshot', () => {
    expect(() =>
        serverUsageOverviewSchema.parse({
            computers: [
                {
                    architecture: 'arm64',
                    computerId: 'cmp_1234567890123456',
                    health: 'offline',
                    operatingSystem: 'darwin',
                    productVersion: '1.0.0',
                    reportedAt: '2026-07-28T20:00:01.000Z',
                    usage,
                },
                {
                    architecture: null,
                    computerId: 'cmp_6543210987654321',
                    health: 'healthy',
                    operatingSystem: null,
                    productVersion: null,
                    reportedAt: null,
                    usage: null,
                },
            ],
        })
    ).not.toThrow();
});
