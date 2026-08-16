import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TokenConfigurationGrid } from './token-configuration-grid.tsx';
import { TokenTotalKpis } from './token-total-kpis.tsx';
import { TokenUsageChart } from './token-usage-chart.tsx';
import { AgentsTokenUsage, AgentTokenUsage } from './token-usage-module.tsx';
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

test('Agents overview lets the usage controls and data speak for themselves', () => {
    const html = renderToStaticMarkup(
        <AgentsTokenUsage usage={{ breakdown: [], days: 90, totals }} />
    );

    expect(html).toContain('aria-label="Token usage range"');
    expect(html).not.toContain('Usage by Agent');
    expect(html).not.toContain('Choose an Agent');
});

test('Agent profile retains its local usage heading', () => {
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
    expect(html).toContain('Token volume across this Agent');
    expect(html).toContain('runtime and model configurations.');
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
