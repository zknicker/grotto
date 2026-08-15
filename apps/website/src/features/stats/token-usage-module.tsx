import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { TokenUsageOverview } from '@tavern/api';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { AgentUsageKpis } from './agent-usage-kpis.tsx';
import { TokenConfigurationGrid } from './token-configuration-grid.tsx';
import { TokenTotalKpis } from './token-total-kpis.tsx';
import { TokenUsageChart } from './token-usage-chart.tsx';
import {
    buildAgentTokenUsageView,
    buildTokenUsageView,
    type TokenUsageAgentIdentity,
    type TokenUsageRange,
    type TokenUsageScope,
    type TokenUsageView,
} from './token-usage-view.ts';

const ranges: TokenUsageRange[] = [7, 30, 90];

export function AgentsTokenUsage({
    emptyMessage,
    scope,
    usage,
}: {
    emptyMessage?: string;
    scope?: TokenUsageScope;
    usage: TokenUsageOverview;
}) {
    const [days, setDays] = useState<TokenUsageRange>(30);
    const [selectedAgentId, setSelectedAgentId] = useState<null | string>(null);
    const view = useMemo(
        () => buildTokenUsageView(usage, days, selectedAgentId, new Date(), scope),
        [days, scope, selectedAgentId, usage]
    );

    return (
        <UsageDashboard days={days} emptyMessage={emptyMessage} onRangeChange={setDays} view={view}>
            {view.agents.length > 0 ? (
                <AgentUsageKpis
                    agents={view.agents}
                    onSelect={setSelectedAgentId}
                    selectedAgentId={view.selectedAgent?.agentId ?? null}
                />
            ) : null}
        </UsageDashboard>
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
        <UsageDashboard
            days={days}
            heading={
                <div>
                    <h2 className="font-semibold text-lg">Usage</h2>
                    <p className="text-muted text-sm">
                        Token volume across this Agent's runtime and model configurations.
                    </p>
                </div>
            }
            onRangeChange={setDays}
            view={view}
        />
    );
}

function UsageDashboard({
    children,
    days,
    emptyMessage,
    heading,
    onRangeChange,
    view,
}: {
    children?: ReactNode;
    days: TokenUsageRange;
    emptyMessage?: string;
    heading?: ReactNode;
    onRangeChange: (days: TokenUsageRange) => void;
    view: TokenUsageView;
}) {
    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-end justify-end gap-3 px-1.5">
                {heading ? <div className="me-auto">{heading}</div> : null}
                <RangePicker days={days} onChange={onRangeChange} />
            </div>
            {children}
            <TokenUsageChart emptyMessage={emptyMessage} view={view} />
            <TokenTotalKpis totals={view.totals} />
            <TokenConfigurationGrid rows={view.configurations} />
        </div>
    );
}

function RangePicker({
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
            size="sm"
        >
            {ranges.map((range) => (
                <ToggleButton id={String(range)} key={range}>
                    {range} days
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
