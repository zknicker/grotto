import { KPIGroup } from '@heroui-pro/react';
import { KPI } from '@heroui-pro/react/kpi';
import type { TokenTotals } from './token-usage-view.ts';

// KPIGroup stretches every card to one height and KPI.Content defaults to
// `flex: 1`, so a card whose footer wraps to one line instead of two hands that
// slack to its value row and drops the number below its peers. Sizing content to
// its own height keeps values and footers on one line each and parks the slack
// at the bottom of the short card.
export function TokenTotalKpis({ totals }: { totals: TokenTotals }) {
    const cacheRate = totals.inputTokens > 0 ? totals.cacheReadTokens / totals.inputTokens : 0;
    return (
        <KPIGroup className="overflow-x-auto">
            <KPI>
                <KPI.Header>
                    <KPI.Title>Input</KPI.Title>
                </KPI.Header>
                <KPI.Content className="grow-0">
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
                <KPI.Content className="grow-0">
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
                <KPI.Content className="grow-0">
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
                <KPI.Content className="grow-0">
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
