import { ChartTooltip, Widget } from '@heroui-pro/react';
import { BarChart } from '@heroui-pro/react/bar-chart';
import type { TokenUsageView } from './token-usage-view.ts';
import { formatTokens } from './usage-format.ts';

export function TokenUsageChart({
    emptyMessage = 'Token usage will appear after a Grotto Agent completes a model turn.',
    view,
}: {
    emptyMessage?: string;
    view: TokenUsageView;
}) {
    if (view.totals.totalTokens === 0) {
        return (
            <Widget>
                <Widget.Header>
                    <Widget.Title>Daily processed tokens</Widget.Title>
                </Widget.Header>
                <Widget.Content className="flex min-h-80 items-center justify-center text-center">
                    <p className="max-w-sm text-base text-muted">{emptyMessage}</p>
                </Widget.Content>
            </Widget>
        );
    }

    return (
        <Widget>
            <Widget.Header>
                <Widget.Title>Daily processed tokens</Widget.Title>
                <Widget.Legend>
                    {view.chartConfigurations.map((configuration) => (
                        <Widget.LegendItem color={configuration.color} key={configuration.id}>
                            {configurationLabel(configuration)}
                        </Widget.LegendItem>
                    ))}
                </Widget.Legend>
            </Widget.Header>
            <Widget.Content>
                <BarChart data={view.chartData} height={220}>
                    <BarChart.Grid vertical={false} />
                    <BarChart.XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => formatChartDate(value)}
                        tickMargin={8}
                    />
                    <BarChart.YAxis
                        tickFormatter={(value: number) => formatTokens(value)}
                        width={48}
                    />
                    {view.chartConfigurations.map((configuration, index) => (
                        <BarChart.Bar
                            dataKey={configuration.id}
                            fill={configuration.color}
                            key={configuration.id}
                            name={configurationLabel(configuration)}
                            radius={
                                index === view.chartConfigurations.length - 1
                                    ? [4, 4, 0, 0]
                                    : undefined
                            }
                            stackId="tokens"
                        />
                    ))}
                    <BarChart.Tooltip
                        content={({ active, label, payload }) => {
                            if (!(active && payload?.length)) {
                                return null;
                            }
                            return (
                                <ChartTooltip indicator="line">
                                    <ChartTooltip.Header>{label}</ChartTooltip.Header>
                                    {payload
                                        .filter((entry) => Number(entry.value) > 0)
                                        .map((entry) => (
                                            <ChartTooltip.Item key={String(entry.dataKey)}>
                                                <ChartTooltip.Indicator
                                                    color={
                                                        view.chartConfigurations.find(
                                                            (item) => item.id === entry.dataKey
                                                        )?.color
                                                    }
                                                />
                                                <ChartTooltip.Label>
                                                    {entry.name}
                                                </ChartTooltip.Label>
                                                <ChartTooltip.Value>
                                                    {formatTokens(Number(entry.value))}
                                                </ChartTooltip.Value>
                                            </ChartTooltip.Item>
                                        ))}
                                </ChartTooltip>
                            );
                        }}
                    />
                </BarChart>
            </Widget.Content>
        </Widget>
    );
}

function formatChartDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00.000Z`));
}

function configurationLabel(configuration: TokenUsageView['chartConfigurations'][number]) {
    return configuration.isOther
        ? `${configuration.agentName} · ${configuration.modelId}`
        : `${configuration.agentName} · ${configuration.runtimeLabel} · ${configuration.modelId}`;
}
