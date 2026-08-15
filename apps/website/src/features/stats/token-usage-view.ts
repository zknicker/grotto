import type { TokenUsageOverview } from '@tavern/api';
import { runtimeUsageLabel, tokenConfigurationColor } from './token-usage-colors.ts';

export type TokenUsageRange = 7 | 30 | 90;

const tokenFields = [
    'cacheReadTokens',
    'cacheWriteTokens',
    'inputTokens',
    'outputTokens',
    'totalTokens',
] as const;
const otherConfigurationId = 'other-configurations';

export type TokenTotals = TokenUsageOverview['totals'];

export interface AgentUsage extends TokenTotals {
    agentAvatarUrl: null | string;
    agentHandle: string;
    agentId: string;
    agentName: string;
    color: string;
}

export interface ConfigurationUsage extends TokenTotals {
    agentAvatarUrl: null | string;
    agentHandle: string;
    agentId: string;
    agentName: string;
    color: string;
    id: string;
    isOther: boolean;
    modelId: string;
    runtimeId: string;
    runtimeLabel: string;
}

export interface TokenUsageView {
    agents: AgentUsage[];
    chartConfigurations: ConfigurationUsage[];
    chartData: Record<string, number | string>[];
    configurations: ConfigurationUsage[];
    selectedAgent: AgentUsage | null;
    totals: TokenTotals;
}

export interface TokenUsageAgentIdentity {
    agentAvatarUrl: null | string;
    agentHandle: string;
    agentId: string;
    agentName: string;
}

export interface TokenUsageScope {
    agentIds?: string[];
    runtimeId?: string;
}

export function buildTokenUsageView(
    usage: TokenUsageOverview,
    days: TokenUsageRange,
    selectedAgentId: null | string = null,
    now: Date = new Date(),
    scope: TokenUsageScope = {}
): TokenUsageView {
    const rangeDates = datesThroughToday(days, now);
    const startDate = rangeDates[0] ?? '';
    const endDate = rangeDates.at(-1) ?? '';
    const agentIds = scope.agentIds ? new Set(scope.agentIds) : null;
    const rangeBreakdown = usage.breakdown.filter(
        (item) =>
            item.date >= startDate &&
            item.date <= endDate &&
            (!agentIds || agentIds.has(item.agentId)) &&
            (!scope.runtimeId || item.runtimeId === scope.runtimeId)
    );
    const rangeConfigurations = buildConfigurations(rangeBreakdown);
    const agents = buildAgents(rangeBreakdown, rangeConfigurations);
    const selectedAgent = agents.find((agent) => agent.agentId === selectedAgentId) ?? null;
    const effectiveAgentId = selectedAgent?.agentId ?? null;
    const scopedBreakdown = effectiveAgentId
        ? rangeBreakdown.filter((item) => item.agentId === effectiveAgentId)
        : rangeBreakdown;
    const configurations = effectiveAgentId
        ? rangeConfigurations.filter((item) => item.agentId === effectiveAgentId)
        : rangeConfigurations;
    const chartConfigurations = buildChartConfigurations(configurations);
    const visibleConfigurationIds = new Set(
        chartConfigurations.filter((item) => !item.isOther).map((item) => item.id)
    );
    const totals = emptyTotals();

    for (const item of scopedBreakdown) {
        addTotals(totals, item);
    }

    const chartLookup = new Map<string, number>();
    for (const item of scopedBreakdown) {
        const configuration = configurationId(item.agentId, item.runtimeId, item.modelId);
        const id = visibleConfigurationIds.has(configuration)
            ? configuration
            : otherConfigurationId;
        chartLookup.set(
            `${item.date}\u0000${id}`,
            (chartLookup.get(`${item.date}\u0000${id}`) ?? 0) + item.totalTokens
        );
    }
    const chartData = rangeDates.map((date) => {
        const point: Record<string, number | string> = { date, label: formatDay(date) };
        for (const config of chartConfigurations) {
            point[config.id] = chartLookup.get(`${date}\u0000${config.id}`) ?? 0;
        }
        return point;
    });

    return { agents, chartConfigurations, chartData, configurations, selectedAgent, totals };
}

export function buildAgentTokenUsageView(
    usage: TokenUsageOverview,
    days: TokenUsageRange,
    agent: TokenUsageAgentIdentity,
    now: Date = new Date()
): TokenUsageView {
    const view = buildTokenUsageView(usage, days, agent.agentId, now, {
        agentIds: [agent.agentId],
    });
    if (view.selectedAgent) {
        return view;
    }
    return {
        ...view,
        selectedAgent: {
            ...agent,
            color: 'var(--color-accent)',
            ...emptyTotals(),
        },
    };
}

function buildAgents(
    breakdown: TokenUsageOverview['breakdown'],
    configurations: ConfigurationUsage[]
): AgentUsage[] {
    const agentColors = new Map<string, string>();
    for (const configuration of configurations) {
        if (!agentColors.has(configuration.agentId)) {
            agentColors.set(configuration.agentId, configuration.color);
        }
    }
    const agents = new Map<string, AgentUsage>();
    for (const item of breakdown) {
        const agent = agents.get(item.agentId) ?? {
            agentAvatarUrl: item.agentAvatarUrl,
            agentHandle: item.agentHandle,
            agentId: item.agentId,
            agentName: item.agentName,
            color: agentColors.get(item.agentId) ?? 'var(--color-accent)',
            ...emptyTotals(),
        };
        addTotals(agent, item);
        agents.set(item.agentId, agent);
    }
    return [...agents.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function buildConfigurations(breakdown: TokenUsageOverview['breakdown']): ConfigurationUsage[] {
    const configurations = new Map<string, ConfigurationUsage>();
    for (const item of breakdown) {
        const id = configurationId(item.agentId, item.runtimeId, item.modelId);
        const configuration = configurations.get(id) ?? {
            agentAvatarUrl: item.agentAvatarUrl,
            agentHandle: item.agentHandle,
            agentId: item.agentId,
            agentName: item.agentName,
            color: '',
            id,
            isOther: false,
            modelId: item.modelId,
            runtimeId: item.runtimeId,
            runtimeLabel: runtimeUsageLabel(item.runtimeId),
            ...emptyTotals(),
        };
        addTotals(configuration, item);
        configurations.set(id, configuration);
    }
    const sorted = [...configurations.values()].sort((a, b) => b.totalTokens - a.totalTokens);
    const colorByConfiguration = new Map<string, string>();
    const usedColors = new Set<string>();
    for (const configuration of [...sorted].sort((a, b) => a.id.localeCompare(b.id))) {
        const color = tokenConfigurationColor(configuration, usedColors);
        usedColors.add(color);
        colorByConfiguration.set(configuration.id, color);
    }
    return sorted.map((configuration) => ({
        ...configuration,
        color: colorByConfiguration.get(configuration.id) ?? 'var(--runtime-other-1)',
    }));
}

function buildChartConfigurations(configurations: ConfigurationUsage[]) {
    if (configurations.length <= 8) {
        return configurations;
    }
    const hidden = configurations.slice(7);
    const other: ConfigurationUsage = {
        agentAvatarUrl: null,
        agentHandle: '',
        agentId: otherConfigurationId,
        agentName: 'Other configurations',
        color: 'var(--runtime-other-1)',
        id: otherConfigurationId,
        isOther: true,
        modelId: `${hidden.length} configurations`,
        runtimeId: 'mixed',
        runtimeLabel: 'Mixed runtimes',
        ...emptyTotals(),
    };
    for (const configuration of hidden) {
        addTotals(other, configuration);
    }
    return [...configurations.slice(0, 7), other];
}

function configurationId(agentId: string, runtimeId: string, modelId: string) {
    return `${agentId}:${runtimeId}:${modelId}`;
}

function datesThroughToday(days: number, now: Date) {
    const end = new Date(now);
    end.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, index) => {
        const date = new Date(end);
        date.setUTCDate(end.getUTCDate() - (days - index - 1));
        return date.toISOString().slice(0, 10);
    });
}

function formatDay(date: string) {
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`));
}

function emptyTotals(): TokenTotals {
    return {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    };
}

function addTotals(target: TokenTotals, source: TokenTotals) {
    for (const field of tokenFields) {
        target[field] += source[field];
    }
}
