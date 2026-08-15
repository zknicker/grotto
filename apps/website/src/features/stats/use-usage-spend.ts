import type { UsageOverview } from '@tavern/api';
import { useMemo } from 'react';

export const openRouterKeyColors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
];

export interface UsageKeyStat {
    color: string;
    id: string;
    label: string;
    percent: number;
    total: number;
}

export function useUsageSpend(liveUsage: UsageOverview) {
    const openRouter = liveUsage.openRouter;
    const activity = openRouter.overview;
    const keys = activity?.keys ?? [];
    const series = activity?.series ?? [];
    const latestReportedDate = series.at(-1)?.date ?? null;
    const chartData = series.map((point) => ({
        day: formatDay(point.date),
        ...point.values,
    }));
    const hasChart = keys.length > 0 && chartData.length > 0;
    const emptyChartMessage =
        openRouter?.status === 'error'
            ? (openRouter.error?.message ?? 'OpenRouter activity is unavailable.')
            : (activity?.message ?? 'Add an OpenRouter management key to load account activity.');

    const keyStats = useMemo<UsageKeyStat[]>(() => {
        if (!hasChart) {
            return [];
        }

        const totals = keys.map((key, index) => ({
            color: openRouterKeyColors[index % openRouterKeyColors.length],
            id: key.id,
            label: key.label,
            percent: 0,
            total: series.reduce((sum, point) => sum + (point.values[key.id] ?? 0), 0),
        }));
        const grandTotal = totals.reduce((sum, stat) => sum + stat.total, 0);

        for (const stat of totals) {
            stat.percent = grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0;
        }

        return totals;
    }, [hasChart, keys, series]);

    return {
        chartData,
        emptyChartMessage,
        grandTotal: keyStats.reduce((sum, stat) => sum + stat.total, 0),
        hasChart,
        keyStats,
        keys,
        latestReportedDate,
    };
}

function formatDay(date: string) {
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`));
}
