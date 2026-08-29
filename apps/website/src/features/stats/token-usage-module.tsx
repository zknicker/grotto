import type { TokenUsageOverview } from '@grotto/api';
import { ToggleButton, ToggleButtonGroup, Toolbar } from '@heroui/react';
import { ItemCardGroup } from '@heroui-pro/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { TokenConfigurationGrid } from './token-configuration-grid.tsx';
import { TokenTotalKpis } from './token-total-kpis.tsx';
import { TokenUsageChart } from './token-usage-chart.tsx';
import {
    buildAgentTokenUsageView,
    type TokenUsageAgentIdentity,
    type TokenUsageRange,
    type TokenUsageView,
} from './token-usage-view.ts';

const ranges: TokenUsageRange[] = [7, 30, 90];

/**
 * The dashboard body, general to specific: filters, range totals, the daily
 * trend, then the per-configuration breakdown as its own titled section.
 * Controls, totals, and chart share the tight grid-card gap so they read as
 * one cluster rather than equally spaced islands. A fragment, so the hosting
 * column's own rhythm separates cluster from breakdown.
 *
 * The filters sit on the cluster, not in the shell band: the band's 3rem
 * chrome fits compact actions, and Select has no compact size, so a
 * field-height control up there crowds the window edge instead of aligning
 * with the cards it filters.
 */
export function TokenUsageDashboard({
    controls,
    emptyMessage,
    view,
}: {
    controls?: ReactNode;
    emptyMessage?: string;
    view: TokenUsageView;
}) {
    return (
        <>
            <div className="grid gap-3">
                {controls ? (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <Toolbar aria-label="Usage filters">{controls}</Toolbar>
                    </div>
                ) : null}
                <TokenUsageCluster emptyMessage={emptyMessage} view={view} />
            </div>
            <TokenConfigurationGrid rows={view.configurations} />
        </>
    );
}

export function AgentTokenUsage({
    agent,
    usage,
}: {
    agent: TokenUsageAgentIdentity;
    usage: TokenUsageOverview;
}) {
    const [days, setDays] = useState<TokenUsageRange>(30);
    const view = useMemo(() => buildAgentTokenUsageView(usage, days, agent), [agent, days, usage]);

    return (
        <>
            <ItemCardGroup variant="transparent">
                {/* Title and range picker share one line, no wrap: section
                    titles here carry no descriptions, and the picker scopes
                    this section so it rides the header even at narrow pane
                    widths. */}
                <ItemCardGroup.Header className="flex items-center justify-between gap-3">
                    <ItemCardGroup.Title>Usage</ItemCardGroup.Title>
                    <Toolbar aria-label="Usage filters">
                        <TokenUsageRangePicker days={days} onChange={setDays} />
                    </Toolbar>
                </ItemCardGroup.Header>
                {/* No KPI totals here: on a profile they were a third
                    representation of what the trend and the per-configuration
                    table already say. The server-wide Usage page keeps them —
                    there they summarize many Agents at once. */}
                <TokenUsageChart view={view} />
            </ItemCardGroup>
            <TokenConfigurationGrid rows={view.configurations} />
        </>
    );
}

function TokenUsageCluster({
    emptyMessage,
    view,
}: {
    emptyMessage?: string;
    view: TokenUsageView;
}) {
    return (
        <div className="grid gap-3">
            <TokenTotalKpis totals={view.totals} />
            <TokenUsageChart emptyMessage={emptyMessage} view={view} />
        </div>
    );
}

export function TokenUsageRangePicker({
    days,
    onChange,
}: {
    days: TokenUsageRange;
    onChange: (days: TokenUsageRange) => void;
}) {
    return (
        <ToggleButtonGroup
            aria-label="Token usage range"
            disallowEmptySelection
            onSelectionChange={(keys) => {
                const selected = Number([...keys][0]);
                if (selected === 7 || selected === 30 || selected === 90) {
                    onChange(selected);
                }
            }}
            selectedKeys={new Set([String(days)])}
            selectionMode="single"
        >
            {ranges.map((range) => (
                <ToggleButton id={String(range)} key={range}>
                    {range} days
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
