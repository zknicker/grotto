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
    // An empty range still has real dates and a real scale, so draw the chart
    // rather than a placeholder panel: the frame is the answer, and the caption
    // says why it is flat.
    if (view.totals.totalTokens === 0) {
        return (
            <Widget>
                <Widget.Header>
                    <Widget.Title>Daily processed tokens</Widget.Title>
                </Widget.Header>
                <Widget.Content className="grid gap-3">
                    <BarChart
                        data={view.chartData.map((point) => ({ ...point, empty: 0 }))}
                        height={220}
                    >
                        <BarChart.Grid vertical={false} />
                        <BarChart.XAxis
                            dataKey="date"
                            tickFormatter={(value: string) => formatChartDate(value)}
                            tickMargin={8}
                        />
                        <BarChart.YAxis
                            domain={[0, 1]}
                            tickFormatter={(value: number) => formatTokens(value)}
                            ticks={[0]}
                            width={48}
                        />
                        {/* Recharts derives the numeric scale from the series, so
                            a zero-height bar is what keeps the baseline drawn. */}
                        <BarChart.Bar dataKey="empty" fill="transparent" />
                    </BarChart>
                    <p className="text-muted text-sm">{emptyMessage}</p>
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
