import * as z from 'zod';

const hostedTimestampSchema = z.iso.datetime({ offset: true });
const usageErrorSchema = z
    .object({
        code: z.enum(['auth', 'parse', 'request', 'unknown']),
        message: z.string(),
        name: z.string(),
    })
    .strict();
const codexUsageWindowSchema = z
    .object({
        id: z.enum(['current-session', 'current-week']),
        label: z.string(),
        remainingPercent: z.number().min(0).max(100),
        resetAfterSeconds: z.number().nonnegative().nullable(),
        resetsAt: hostedTimestampSchema.nullable(),
        usedPercent: z.number().min(0).max(100),
    })
    .strict();
const codexUsageSnapshotSchema = z
    .object({
        capturedAt: hostedTimestampSchema,
        creditsBalance: z.number().nonnegative().nullable(),
        planType: z.string().nullable(),
        provider: z.literal('codex'),
        source: z.literal('chatgpt-wham-usage'),
        windows: z.array(codexUsageWindowSchema),
    })
    .strict();
const codexUsageStateSchema = z.discriminatedUnion('status', [
    z
        .object({
            error: usageErrorSchema,
            provider: z.literal('codex'),
            status: z.literal('error'),
        })
        .strict(),
    z
        .object({
            provider: z.literal('codex'),
            snapshot: codexUsageSnapshotSchema,
            status: z.literal('ok'),
        })
        .strict(),
]);
const openRouterOverviewSchema = z
    .object({
        days: z.number().int().nonnegative(),
        keys: z.array(
            z
                .object({
                    id: z.string(),
                    label: z.string(),
                    providerName: z.string(),
                })
                .strict()
        ),
        message: z.string().nullable(),
        note: z.string().nullable(),
        series: z.array(
            z
                .object({
                    date: z.string(),
                    values: z.record(z.string(), z.number()),
                })
                .strict()
        ),
        status: z.enum(['empty', 'ready', 'unconfigured']),
        totalByokUsageUsd: z.number().nonnegative(),
        totalRequests: z.number().int().nonnegative(),
        totalUsageUsd: z.number().nonnegative(),
    })
    .strict();
const openRouterUsageStateSchema = z
    .object({
        error: usageErrorSchema.nullable(),
        overview: openRouterOverviewSchema,
        status: z.enum(['error', 'ok']),
    })
    .strict();

export const hostedServerStatsInputSchema = z
    .object({ serverId: z.string().trim().min(1) })
    .strict();

/**
 * Exact pre-WS6 provider-usage payload, now transported Computer → Server →
 * App. Credentials and provider calls stay on the assigned Computer.
 */
export const hostedUsageOverviewSchema = z
    .object({
        capturedAt: hostedTimestampSchema,
        codex: codexUsageStateSchema,
        connectedProviders: z.array(z.enum(['openai-codex', 'openrouter'])),
        openRouter: openRouterUsageStateSchema,
    })
    .strict();

export const hostedUsageReportSchema = z
    .object({
        type: z.literal('usage-report'),
        usage: hostedUsageOverviewSchema,
    })
    .strict();

export const hostedComputerUsageSchema = z
    .object({
        architecture: z.string().nullable(),
        computerId: z.string().trim().min(1),
        health: z.enum(['degraded', 'healthy', 'offline', 'update-required']),
        operatingSystem: z.string().nullable(),
        productVersion: z.string().nullable(),
        reportedAt: hostedTimestampSchema.nullable(),
        usage: hostedUsageOverviewSchema.nullable(),
    })
    .strict();

export const hostedServerUsageOverviewSchema = z
    .object({ computers: z.array(hostedComputerUsageSchema) })
    .strict();

export type HostedComputerUsage = z.infer<typeof hostedComputerUsageSchema>;
export type HostedServerUsageOverview = z.infer<typeof hostedServerUsageOverviewSchema>;
export type HostedUsageOverview = z.infer<typeof hostedUsageOverviewSchema>;
export type HostedUsageReport = z.infer<typeof hostedUsageReportSchema>;
