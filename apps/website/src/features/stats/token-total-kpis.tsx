import { KPIGroup } from '@heroui-pro/react';
import { KPI } from '@heroui-pro/react/kpi';
import type { TokenTotals } from './token-usage-view.ts';

export function TokenTotalKpis({ totals }: { totals: TokenTotals }) {
    const cacheRate = totals.inputTokens > 0 ? totals.cacheReadTokens / totals.inputTokens : 0;
    return (
        <KPIGroup className="overflow-x-auto">
            <KPI>
                <KPI.Header>
                    <KPI.Title>Input</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                    <KPI.Value
                        maximumFractionDigits={1}
                        notation="compact"
                        value={totals.inputTokens}
                    />
                </KPI.Content>
                <KPI.Footer className="text-sm">Includes cached input</KPI.Footer>
            </KPI>
            <KPIGroup.Separator />
            <KPI>
                <KPI.Header>
                    <KPI.Title>Output</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                    <KPI.Value
                        maximumFractionDigits={1}
                        notation="compact"
                        value={totals.outputTokens}
                    />
                </KPI.Content>
                <KPI.Footer className="text-sm">Responses and reasoning</KPI.Footer>
            </KPI>
            <KPIGroup.Separator />
            <KPI>
                <KPI.Header>
                    <KPI.Title>Cache read</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                    <KPI.Value
                        maximumFractionDigits={1}
                        notation="compact"
                        value={totals.cacheReadTokens}
                    />
                </KPI.Content>
                <KPI.Footer className="text-sm">
                    {new Intl.NumberFormat(undefined, {
                        maximumFractionDigits: 1,
                        style: 'percent',
                    }).format(cacheRate)}{' '}
                    of input
                </KPI.Footer>
            </KPI>
            <KPIGroup.Separator />
            <KPI>
                <KPI.Header>
                    <KPI.Title>Cache write</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                    <KPI.Value
                        maximumFractionDigits={1}
                        notation="compact"
                        value={totals.cacheWriteTokens}
                    />
                </KPI.Content>
                <KPI.Footer className="text-sm">New reusable context</KPI.Footer>
            </KPI>
        </KPIGroup>
    );
}
