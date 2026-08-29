import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TokenConfigurationGrid } from './token-configuration-grid.tsx';
import { TokenTotalKpis } from './token-total-kpis.tsx';
import { TokenUsageChart } from './token-usage-chart.tsx';
import { AgentTokenUsage, TokenUsageDashboard } from './token-usage-module.tsx';
import type { TokenUsageView } from './token-usage-view.ts';

const totals = {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
};

test('Agent usage uses the HeroUI Pro dashboard primitives', () => {
    const view: TokenUsageView = {
        agents: [],
        chartConfigurations: [],
        chartData: [],
        configurations: [],
        selectedAgent: null,
        totals,
    };
    const html = renderToStaticMarkup(
        <>
            <TokenUsageChart view={view} />
            <TokenTotalKpis totals={totals} />
            <TokenConfigurationGrid rows={[]} />
        </>
    );

    expect(html).toContain('data-slot="widget"');
    expect(html).toContain('data-slot="widget-content"');
    expect(html).toContain('data-slot="kpi-group"');
    expect(html).toContain('data-slot="item-card-group-header"');
    expect(html).toContain('Token usage detail');
    expect(html).not.toContain('Agent × runtime × model');
    expect(html.match(/data-slot="kpi"/g)).toHaveLength(4);
});

test('Usage dashboard keeps its filters on the content cluster', () => {
    const view: TokenUsageView = {
        agents: [],
        chartConfigurations: [],
        chartData: [],
        configurations: [],
        selectedAgent: null,
        totals,
    };
    const html = renderToStaticMarkup(
        <TokenUsageDashboard controls={<button type="button">range</button>} view={view} />
    );

    // The shell band's 3rem chrome cannot host field-height controls, so the
    // filters lead the cluster they act on — then general to specific:
    // totals before the daily trend.
    const toolbar = html.indexOf('aria-label="Usage filters"');
    const kpis = html.indexOf('data-slot="kpi-group"');
    expect(toolbar).toBeGreaterThan(-1);
    expect(toolbar).toBeLessThan(kpis);
    expect(kpis).toBeLessThan(html.indexOf('data-slot="widget"'));
});

test('Agent profile retains its local usage heading and range', () => {
    const html = renderToStaticMarkup(
        <AgentTokenUsage
            agent={{
                agentAvatarUrl: null,
                agentHandle: 'blippy',
                agentId: 'blippy',
                agentName: 'Blippy',
            }}
            usage={{ breakdown: [], days: 90, totals }}
        />
    );

    expect(html).toContain('>Usage<');
    // Section titles carry no descriptions — the title and range picker share
    // the header line.
    expect(html).not.toContain('Token volume across this Agent');
    // The range scopes this one section, so it rides the section header.
    expect(html).toContain('aria-label="Usage filters"');
    // No KPI totals on the profile — the chart and the configuration table
    // already carry that data.
    expect(html).not.toContain('data-slot="kpi-group"');
    expect(html.indexOf('data-slot="item-card-group-header"')).toBeLessThan(
        html.indexOf('data-slot="widget"')
    );
});

test('Token chart follows the Widget chart composition', () => {
    const configuration = {
        agentAvatarUrl: '/blippy.png',
        agentHandle: 'blippy',
        agentId: 'blippy',
        agentName: 'Blippy',
        cacheReadTokens: 90_000,
        cacheWriteTokens: 0,
        color: 'var(--chart-1)',
        id: 'blippy:codex:gpt-5.6-sol',
        inputTokens: 115_000,
        isOther: false,
        modelId: 'gpt-5.6-sol',
        outputTokens: 1200,
        runtimeId: 'codex',
        runtimeLabel: 'Codex',
        totalTokens: 116_200,
    };
    const html = renderToStaticMarkup(
        <TokenUsageChart
            view={{
                agents: [],
                chartConfigurations: [configuration],
                chartData: [
                    {
                        date: '2026-08-14',
                        label: 'Aug 14',
                        [configuration.id]: configuration.totalTokens,
                    },
                ],
                configurations: [configuration],
                selectedAgent: null,
                totals: configuration,
            }}
        />
    );
    const header = html.indexOf('data-slot="widget-header"');
    const legend = html.indexOf('data-slot="widget-legend"');
    const content = html.indexOf('data-slot="widget-content"');

    expect(html).toContain('Daily processed tokens');
    expect(html).not.toContain('/blippy.png');
    expect(header).toBeGreaterThan(-1);
    expect(legend).toBeGreaterThan(header);
    expect(content).toBeGreaterThan(legend);
});
