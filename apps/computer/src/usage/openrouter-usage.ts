import type { HostedUsageOverview } from '@tavern/api';
import { z } from 'zod';

type OpenRouterOverview = HostedUsageOverview['openRouter']['overview'];
type OpenRouterFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const activityRowSchema = z
    .object({
        byok_usage_inference: z.number(),
        date: z.string(),
        model_permaslug: z.string(),
        provider_name: z.string(),
        requests: z.number(),
        usage: z.number(),
    })
    .passthrough();

const activityResponseSchema = z.object({ data: z.array(activityRowSchema) });

export async function readOpenRouterUsage(
    capturedAt: Date,
    options: {
        fetch?: OpenRouterFetch;
        managementApiKey?: string | null;
    } = {}
): Promise<OpenRouterOverview> {
    const managementApiKey = options.managementApiKey?.trim() || null;
    if (!managementApiKey) {
        return emptyOverview(
            capturedAt,
            'unconfigured',
            'Configure a Computer management key to load OpenRouter activity.'
        );
    }

    const response = await (options.fetch ?? fetch)('https://openrouter.ai/api/v1/activity', {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${managementApiKey}`,
        },
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        throw new Error(
            response.status === 401 || response.status === 403
                ? 'OpenRouter rejected the Computer management key.'
                : `OpenRouter activity request failed with status ${response.status}.`
        );
    }

    const payload = activityResponseSchema.parse(await response.json());
    return buildOverview(payload.data, capturedAt);
}

function buildOverview(
    rows: z.infer<typeof activityRowSchema>[],
    capturedAt: Date
): OpenRouterOverview {
    const dates = utcDates(capturedAt);
    const dateSet = new Set(dates);
    const keys = new Map<string, { label: string; providerName: string; totalUsageUsd: number }>();
    const series = new Map(
        dates.map((date) => [date, { date, values: {} as Record<string, number> }])
    );
    let totalByokUsageUsd = 0;
    let totalRequests = 0;
    let totalUsageUsd = 0;

    for (const row of rows) {
        const date = row.date.slice(0, 10);
        const point = series.get(date);
        if (!(dateSet.has(date) && point)) {
            continue;
        }
        const id = row.model_permaslug;
        const usage = row.usage + row.byok_usage_inference;
        const existing = keys.get(id);

        point.values[id] = (point.values[id] ?? 0) + usage;
        totalByokUsageUsd += row.byok_usage_inference;
        totalRequests += row.requests;
        totalUsageUsd += row.usage;
        keys.set(id, {
            label: row.model_permaslug,
            providerName: row.provider_name,
            totalUsageUsd: (existing?.totalUsageUsd ?? 0) + usage,
        });
    }

    const orderedKeys = [...keys]
        .sort(
            ([leftId, left], [rightId, right]) =>
                right.totalUsageUsd - left.totalUsageUsd || leftId.localeCompare(rightId)
        )
        .map(([id, key]) => ({
            id,
            label: key.label,
            providerName: key.providerName,
        }));
    for (const point of series.values()) {
        for (const key of orderedKeys) {
            point.values[key.id] ??= 0;
        }
    }

    return {
        days: dates.length,
        keys: orderedKeys,
        message:
            orderedKeys.length === 0
                ? 'No OpenRouter activity returned for the last 30 UTC days.'
                : null,
        note:
            orderedKeys.length > 0
                ? 'Daily account activity includes OpenRouter credit spend and BYOK inference spend.'
                : null,
        series: [...series.values()],
        status: orderedKeys.length > 0 ? 'ready' : 'empty',
        totalByokUsageUsd,
        totalRequests,
        totalUsageUsd,
    };
}

function emptyOverview(
    capturedAt: Date,
    status: 'empty' | 'unconfigured',
    message: string
): OpenRouterOverview {
    return {
        days: 30,
        keys: [],
        message,
        note: null,
        series: utcDates(capturedAt).map((date) => ({ date, values: {} })),
        status,
        totalByokUsageUsd: 0,
        totalRequests: 0,
        totalUsageUsd: 0,
    };
}

function utcDates(capturedAt: Date): string[] {
    const day = new Date(
        Date.UTC(capturedAt.getUTCFullYear(), capturedAt.getUTCMonth(), capturedAt.getUTCDate())
    );
    return Array.from({ length: 30 }, (_, index) => {
        const date = new Date(day);
        date.setUTCDate(day.getUTCDate() - (29 - index));
        return date.toISOString().slice(0, 10);
    });
}
