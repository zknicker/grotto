import type { TokenUsageOverview } from '@tavern/api';
import { expect, test } from 'vitest';
import { buildAgentTokenUsageView, buildTokenUsageView } from './token-usage-view.ts';

const zero = {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
};

const usage: TokenUsageOverview = {
    breakdown: [
        {
            agentAvatarUrl: '/api/avatars/cove',
            agentHandle: 'cove',
            agentId: 'agt_cove',
            agentName: 'Cove',
            cacheReadTokens: 60,
            cacheWriteTokens: 5,
            date: '2026-08-12',
            inputTokens: 80,
            modelId: 'gpt-5.6-sol',
            outputTokens: 20,
            runtimeId: 'codex',
            totalTokens: 100,
        },
        {
            agentAvatarUrl: null,
            agentHandle: 'scout',
            agentId: 'agt_scout',
            agentName: 'Scout',
            cacheReadTokens: 20,
            cacheWriteTokens: 4,
            date: '2026-08-13',
            inputTokens: 30,
            modelId: 'claude-sonnet-5',
            outputTokens: 10,
            runtimeId: 'claude-code',
            totalTokens: 40,
        },
        {
            agentAvatarUrl: '/api/avatars/cove',
            agentHandle: 'cove',
            agentId: 'agt_cove',
            agentName: 'Cove',
            date: '2026-07-01',
            inputTokens: 900,
            modelId: 'gpt-5.6-sol',
            outputTokens: 100,
            runtimeId: 'codex',
            totalTokens: 1000,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
        },
        {
            agentAvatarUrl: null,
            agentHandle: 'future',
            agentId: 'agt_future',
            agentName: 'Future',
            date: '2026-08-14',
            inputTokens: 900,
            modelId: 'gpt-future',
            outputTokens: 100,
            runtimeId: 'codex',
            totalTokens: 1000,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
        },
    ],
    days: 90,
    totals: zero,
};

test('builds a range-scoped token view by runtime, model, and Grotto agent', () => {
    const view = buildTokenUsageView(usage, 7, null, new Date('2026-08-13T18:00:00.000Z'));

    expect(view.totals).toEqual({
        cacheReadTokens: 80,
        cacheWriteTokens: 9,
        inputTokens: 110,
        outputTokens: 30,
        totalTokens: 140,
    });
    expect(view.agents.map((agent) => [agent.agentName, agent.totalTokens])).toEqual([
        ['Cove', 100],
        ['Scout', 40],
    ]);
    expect(view.configurations.map((model) => [model.modelId, model.totalTokens])).toEqual([
        ['gpt-5.6-sol', 100],
        ['claude-sonnet-5', 40],
    ]);
    expect(view.chartData).toHaveLength(7);
    expect(view.chartData.at(-1)).toMatchObject({
        'agt_cove:codex:gpt-5.6-sol': 0,
        'agt_scout:claude-code:claude-sonnet-5': 40,
    });
});

test('scopes totals and configurations to one agent without losing the agent picker', () => {
    const view = buildTokenUsageView(usage, 7, 'agt_cove', new Date('2026-08-13T18:00:00.000Z'));

    expect(view.selectedAgent?.agentName).toBe('Cove');
    expect(view.totals.totalTokens).toBe(100);
    expect(view.configurations.map((item) => item.id)).toEqual(['agt_cove:codex:gpt-5.6-sol']);
    expect(view.agents).toHaveLength(2);
});

test('scopes usage by immutable Computer assignment and runtime', () => {
    const view = buildTokenUsageView(usage, 7, null, new Date('2026-08-13T18:00:00.000Z'), {
        agentIds: ['agt_scout'],
        runtimeId: 'claude-code',
    });

    expect(view.totals.totalTokens).toBe(40);
    expect(view.agents.map((agent) => agent.agentName)).toEqual(['Scout']);
    expect(view.configurations.map((item) => item.runtimeId)).toEqual(['claude-code']);
});

test('keeps quiet Agents in the picker at zero instead of dropping them', () => {
    const view = buildTokenUsageView(
        { breakdown: [], days: 90, totals: zero },
        7,
        null,
        new Date('2026-08-13T18:00:00.000Z'),
        {
            knownAgents: [
                {
                    agentAvatarUrl: null,
                    agentHandle: 'tiny',
                    agentId: 'agt_tiny',
                    agentName: 'Tiny',
                },
                {
                    agentAvatarUrl: null,
                    agentHandle: 'blippy',
                    agentId: 'agt_blippy',
                    agentName: 'Blippy',
                },
            ],
        }
    );

    expect(view.agents.map((agent) => agent.agentName)).toEqual(['Blippy', 'Tiny']);
    expect(view.agents.every((agent) => agent.totalTokens === 0)).toBe(true);
});

test('counts a known Agent usage exactly once', () => {
    const view = buildTokenUsageView(usage, 7, null, new Date('2026-08-13T18:00:00.000Z'), {
        knownAgents: [
            {
                agentAvatarUrl: '/api/avatars/cove',
                agentHandle: 'cove',
                agentId: 'agt_cove',
                agentName: 'Cove',
            },
        ],
    });

    expect(view.agents.find((agent) => agent.agentId === 'agt_cove')?.totalTokens).toBe(100);
    expect(view.agents.filter((agent) => agent.agentId === 'agt_cove')).toHaveLength(1);
});

test('leaves out known Agents excluded by the Computer scope', () => {
    const view = buildTokenUsageView(usage, 7, null, new Date('2026-08-13T18:00:00.000Z'), {
        agentIds: ['agt_scout'],
        knownAgents: [
            {
                agentAvatarUrl: null,
                agentHandle: 'cove',
                agentId: 'agt_cove',
                agentName: 'Cove',
            },
        ],
    });

    expect(view.agents.map((agent) => agent.agentId)).toEqual(['agt_scout']);
});

test('assigns distinct stable colors to each visible Agent and model configuration', () => {
    const sameModelUsage: TokenUsageOverview = {
        ...usage,
        breakdown: [
            usage.breakdown[0]!,
            {
                ...usage.breakdown[0]!,
                agentHandle: 'echo',
                agentId: 'agt_echo',
                agentName: 'Echo',
                totalTokens: 50,
            },
        ],
    };

    const view = buildTokenUsageView(sameModelUsage, 7, null, new Date('2026-08-13T18:00:00.000Z'));

    expect(new Set(view.configurations.map((item) => item.color))).toHaveLength(2);
    expect(view.agents.map((agent) => agent.color)).toEqual(
        view.configurations.map((configuration) => configuration.color)
    );
    const reversedView = buildTokenUsageView(
        { ...sameModelUsage, breakdown: [...sameModelUsage.breakdown].reverse() },
        7,
        null,
        new Date('2026-08-13T18:00:00.000Z')
    );
    expect(Object.fromEntries(view.configurations.map((item) => [item.id, item.color]))).toEqual(
        Object.fromEntries(reversedView.configurations.map((item) => [item.id, item.color]))
    );
});

test('keeps an Agent profile scoped when that Agent has no usage yet', () => {
    const view = buildAgentTokenUsageView(
        usage,
        7,
        {
            agentAvatarUrl: '/api/avatars/new',
            agentHandle: 'new',
            agentId: 'agt_new',
            agentName: 'New Agent',
        },
        new Date('2026-08-13T18:00:00.000Z')
    );

    expect(view.selectedAgent?.agentName).toBe('New Agent');
    expect(view.totals.totalTokens).toBe(0);
    expect(view.configurations).toEqual([]);
});

test('rolls configurations beyond the chart limit into a reconciled Other series', () => {
    const crowded: TokenUsageOverview = {
        ...usage,
        breakdown: Array.from({ length: 9 }, (_, index) => ({
            agentAvatarUrl: null,
            agentHandle: 'cove',
            agentId: 'agt_cove',
            agentName: 'Cove',
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            date: '2026-08-13',
            inputTokens: index + 1,
            modelId: `model-${index}`,
            outputTokens: 0,
            runtimeId: 'codex',
            totalTokens: index + 1,
        })),
    };

    const view = buildTokenUsageView(crowded, 7, null, new Date('2026-08-13T18:00:00.000Z'));
    const lastPoint = view.chartData.at(-1) ?? {};
    const plottedTotal = view.chartConfigurations.reduce(
        (sum, configuration) => sum + Number(lastPoint[configuration.id] ?? 0),
        0
    );

    expect(view.chartConfigurations).toHaveLength(8);
    expect(view.chartConfigurations.at(-1)?.isOther).toBe(true);
    expect(plottedTotal).toBe(view.totals.totalTokens);
});
