import type { TokenUsageOverview } from '@grotto/api';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { AgentUsageScopePicker } from './agent-usage-scope.tsx';
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
        <UsageDashboard
            controls={
                <>
                    {view.agents.length > 0 ? (
                        <AgentUsageScopePicker
                            agents={view.agents}
                            onSelect={setSelectedAgentId}
                            selectedAgentId={view.selectedAgent?.agentId ?? null}
                        />
                    ) : null}
                    <TokenUsageRangePicker days={days} onChange={setDays} />
                </>
            }
            emptyMessage={emptyMessage}
            view={view}
        />
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
            controls={<TokenUsageRangePicker days={days} onChange={setDays} />}
            heading={
                <div>
                    <h2 className="font-semibold text-base">Usage</h2>
                    <p className="text-muted text-sm">
                        Token volume across this Agent's runtime and model configurations.
                    </p>
                </div>
            }
            view={view}
        />
    );
}

function UsageDashboard({
    children,
    controls,
    emptyMessage,
    heading,
    view,
}: {
    children?: ReactNode;
    controls?: ReactNode;
    emptyMessage?: string;
    heading?: ReactNode;
    view: TokenUsageView;
}) {
    return (
        <div className="grid gap-8">
            {/* Scope and range sit with the cards they describe, on the column's
                own edges — not in the shell band, where a page-level filter
                right-aligns against window chrome instead of its content. */}
            {heading || controls ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                    {heading ? <div className="me-auto">{heading}</div> : null}
                    {controls}
                </div>
            ) : null}
            {children}
            <TokenUsageChart emptyMessage={emptyMessage} view={view} />
            <TokenTotalKpis totals={view.totals} />
            <TokenConfigurationGrid rows={view.configurations} />
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
