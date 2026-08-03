import { Button, Card, Description, FieldError, Form, Input, TextField } from '@heroui/react';
import { BarChart } from '@heroui-pro/react';
import { AiAudioIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { useSaveOpenRouterSettings } from '../../hooks/connections/use-save-openrouter-settings.ts';
import type { UsageOverview } from './usage-modules.tsx';
import { UsageSpendSummary } from './usage-spend-summary.tsx';
import { useUsageSpend } from './use-usage-spend.ts';

interface UsageSpendModuleProps {
    allowManagementKeyForm?: boolean;
    liveUsage: UsageOverview | undefined;
}

// HeroUI's categorical series palette, cycled.
const keyColors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
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
                <div className="h-48">
                    <BarChart data={chartData} height={192}>
                        <BarChart.Grid vertical={false} />
                        <BarChart.XAxis dataKey="day" tickMargin={8} />
                        <BarChart.YAxis
                            tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                            width={40}
                        />
                        {keys.map((key, index) => (
                            <BarChart.Bar
                                dataKey={key.id}
                                fill={keyColors[index % keyColors.length]}
                                key={key.id}
                                name={key.label}
                                // Only the topmost segment rounds, so the stack reads as one bar.
                                radius={index === keys.length - 1 ? [4, 4, 0, 0] : undefined}
                                stackId="spend"
                            />
                        ))}
                        <BarChart.Tooltip
                            content={
                                <BarChart.TooltipContent
                                    valueFormatter={(value) => `$${Number(value).toFixed(2)}`}
                                />
                            }
                        />
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
