import { Button, Card, Description, FieldError, Form, Input, TextField } from '@heroui/react';
import { AiAudioIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Bar } from '../../components/charts/bar.tsx';
import { BarChart } from '../../components/charts/bar-chart.tsx';
import { BarXAxis } from '../../components/charts/bar-x-axis.tsx';
import { Grid } from '../../components/charts/grid.tsx';
import { ChartTooltip, type TooltipRow } from '../../components/charts/tooltip/index.ts';
import { YAxis } from '../../components/charts/y-axis.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useSaveOpenRouterSettings } from '../../hooks/connections/use-save-openrouter-settings.ts';
import type { UsageOverview } from './usage-modules.tsx';
import { UsageSpendSummary } from './usage-spend-summary.tsx';
import { useUsageSpend } from './use-usage-spend.ts';

interface UsageSpendModuleProps {
    allowManagementKeyForm?: boolean;
    liveUsage: UsageOverview | undefined;
}

const keyColors = [
    '#f97316',
    '#38bdf8',
    '#a78bfa',
    '#34d399',
    '#fb7185',
    '#facc15',
    '#06b6d4',
    '#f472b6',
];

export function UsageSpendModule({
    allowManagementKeyForm = true,
    liveUsage,
}: UsageSpendModuleProps) {
    const { chartData, emptyChartMessage, grandTotal, hasChart, keyStats, keys } =
        useUsageSpend(liveUsage);
    const needsManagementKey =
        liveUsage?.openRouter.overview.status === 'unconfigured' ||
        liveUsage?.openRouter.error?.code === 'auth';

    if (!hasChart) {
        return (
            <Card>
                <Card.Header>
                    <Card.Title>
                        <span className="flex items-center gap-2">
                            <Icon aria-hidden="true" icon={AiAudioIcon} size={20} />
                            OpenRouter
                        </span>
                    </Card.Title>
                </Card.Header>
                <Card.Content>
                    <div className="flex h-52 items-center justify-center">
                        {needsManagementKey && allowManagementKeyForm ? (
                            <OpenRouterManagementKeyForm />
                        ) : (
                            <p className="text-muted text-sm">
                                {needsManagementKey
                                    ? 'Configure OpenRouter account usage on this Computer with grotto-computer configure-openrouter.'
                                    : emptyChartMessage}
                            </p>
                        )}
                    </div>
                </Card.Content>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <Card.Header>
                <Card.Title>
                    <span className="flex items-center gap-2">
                        <Icon aria-hidden="true" icon={AiAudioIcon} size={20} />
                        OpenRouter
                    </span>
                </Card.Title>
            </Card.Header>
            <Card.Content>
                <div className="h-48" style={usageChartStyleVars}>
                    <BarChart
                        aspectRatio={undefined}
                        data={chartData}
                        margin={{ bottom: 34, left: 44, right: 10, top: 8 }}
                        stacked={true}
                        stackGap={0}
                        xDataKey="day"
                    >
                        <Grid horizontal={true} vertical={false} />
                        <YAxis formatValue={(value) => `$${value.toFixed(0)}`} numTicks={4} />
                        <ChartTooltip rows={(point) => buildUsageSpendTooltipRows(keys, point)} />
                        {keys.map((key, index) => (
                            <Bar
                                dataKey={key.id}
                                fill={keyColors[index % keyColors.length]}
                                key={key.id}
                                lineCap={3}
                            />
                        ))}
                        <BarXAxis maxLabels={6} />
                    </BarChart>
                </div>
                <UsageSpendSummary grandTotal={grandTotal} stats={keyStats} />
            </Card.Content>
        </Card>
    );
}

function OpenRouterManagementKeyForm() {
    const [managementApiKey, setManagementApiKey] = React.useState('');
    const saveSettings = useSaveOpenRouterSettings({
        onSuccess: () => setManagementApiKey(''),
    });

    const handleSubmit = React.useEffectEvent((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        saveSettings.mutate({
            apiKey: null,
            managementApiKey,
        });
    });

    return (
        <Form className="w-full max-w-md gap-3" onSubmit={handleSubmit}>
            <TextField
                aria-label="OpenRouter management key"
                fullWidth
                isInvalid={Boolean(saveSettings.error)}
                onChange={setManagementApiKey}
                type="password"
                value={managementApiKey}
            >
                <Input autoComplete="off" placeholder="OpenRouter management key" />
                <Description>Add a management key to sync OpenRouter account activity.</Description>
                {saveSettings.error ? <FieldError>{saveSettings.error.message}</FieldError> : null}
            </TextField>
            <div className="flex justify-end">
                <Button
                    isDisabled={!managementApiKey.trim()}
                    isPending={saveSettings.isPending}
                    size="sm"
                    type="submit"
                    variant="secondary"
                >
                    Save Key
                </Button>
            </div>
        </Form>
    );
}

function formatDay(date: string) {
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`));
}

function _getOpenRouterRangeLabel(latestReportedDate: string | null) {
    if (!latestReportedDate) {
        return 'Last 30 UTC days';
    }

    return `Through ${formatDay(latestReportedDate)} UTC`;
}

function buildUsageSpendTooltipRows(
    keys: { id: string; label: string }[],
    point: Record<string, unknown>
): TooltipRow[] {
    return keys
        .map((key, index) => {
            const value = Number(point[key.id] ?? 0);

            return {
                color: keyColors[index % keyColors.length] ?? keyColors[0],
                label: key.label,
                value: Number.isFinite(value) ? `$${value.toFixed(2)}` : '$0.00',
            };
        })
        .filter((row) => row.value !== '$0.00');
}

const usageChartStyleVars = {
    '--chart-background': 'var(--surface-tertiary)',
    '--chart-crosshair': 'var(--muted)',
    '--chart-grid': 'color-mix(in srgb, var(--border) 45%, transparent)',
    '--chart-label': 'var(--muted)',
    '--chart-tooltip-background': 'color-mix(in srgb, var(--foreground) 88%, transparent)',
    '--chart-tooltip-foreground': 'var(--background)',
    '--chart-tooltip-muted': 'color-mix(in srgb, var(--background) 62%, transparent)',
} as React.CSSProperties;
