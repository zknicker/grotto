import { describe, expect, test } from 'bun:test';
import type { Agent, TokenUsageOverview } from '@grotto/api';
import { summarizeAgentTokenUsage } from '../../stats/agent-usage-summary.ts';
import {
    type ActiveAgent,
    activeAgentUnit,
    activeAgentWindowDays,
    rankActiveAgents,
    toActiveAgent,
} from './active-agents.ts';

const asOf = new Date('2025-05-08T15:00:00.000Z');

function agent(id: string, displayName: string): Agent {
    return {
        availability: 'idle',
        avatarUrl: null,
        displayName,
        id,
    } as Agent;
}

function entry(
    name: string,
    totalTokens: number,
    activityLabel: null | string = null
): ActiveAgent {
    return { activityLabel, agent: agent(name, name), days: [], totalTokens };
}

function usage(
    rows: readonly { agentId: string; date: string; totalTokens: number }[]
): TokenUsageOverview {
    return {
        breakdown: rows.map((row) => ({
            agentAvatarUrl: null,
            agentHandle: row.agentId,
            agentId: row.agentId,
            agentName: row.agentId,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            date: row.date,
            inputTokens: row.totalTokens,
            modelId: 'model',
            outputTokens: 0,
            runtimeId: 'runtime',
            totalTokens: row.totalTokens,
        })),
        days: 90,
        totals: {
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
        },
    };
}

describe('toActiveAgent', () => {
    test('draws the window it counts, day by day', () => {
        const result = toActiveAgent(
            agent('agt_1', 'Blippy'),
            summarizeAgentTokenUsage(
                usage([
                    { agentId: 'agt_1', date: '2025-05-08', totalTokens: 1200 },
                    { agentId: 'agt_1', date: '2025-05-06', totalTokens: 800 },
                    // Another Agent's tokens, and one older than the window.
                    { agentId: 'agt_2', date: '2025-05-07', totalTokens: 500 },
                    { agentId: 'agt_1', date: '2025-01-01', totalTokens: 900 },
                ]),
                'agt_1',
                activeAgentWindowDays,
                asOf
            ),
            null
        );

        expect(result.totalTokens).toBe(2000);
        expect(result.days).toEqual([0, 0, 0, 0, 800, 0, 1200]);
    });

    test('an Agent with nothing in the window reads as a quiet week', () => {
        const result = toActiveAgent(
            agent('agt_9', 'Quiet'),
            summarizeAgentTokenUsage(usage([]), 'agt_9', activeAgentWindowDays, asOf),
            null
        );

        expect(result.totalTokens).toBe(0);
        expect(result.days).toHaveLength(activeAgentWindowDays);
    });
});

describe('rankActiveAgents', () => {
    test('drops the Agents with no week and nothing running', () => {
        expect(
            rankActiveAgents([entry('Quiet', 0), entry('Busy', 3000)]).map(
                (e) => e.agent.displayName
            )
        ).toEqual(['Busy']);
    });

    test('keeps a working Agent that has not billed a token yet', () => {
        expect(
            rankActiveAgents([entry('Working', 0, 'Editing files · 3m')]).map(
                (e) => e.agent.displayName
            )
        ).toEqual(['Working']);
    });

    test('working first, then the busiest week, then the name', () => {
        expect(
            rankActiveAgents([
                entry('Cove', 9000),
                entry('Tiny', 2000, 'Reading files · 1m'),
                entry('Amber', 4000),
                entry('Zephyr', 4000),
            ]).map((e) => e.agent.displayName)
        ).toEqual(['Tiny', 'Cove', 'Amber', 'Zephyr']);
    });

    test('caps the strip', () => {
        const many = Array.from({ length: 20 }, (_, index) =>
            entry(`Agent ${index}`, (index + 1) * 100)
        );
        expect(rankActiveAgents(many)).toHaveLength(8);
        expect(rankActiveAgents(many, 3)).toHaveLength(3);
    });
});

describe('activeAgentUnit', () => {
    test('names what the figure counts', () => {
        expect(activeAgentUnit({ activityLabel: null })).toBe('Tokens · 7d');
    });

    test('a working Agent spends the line on its step instead', () => {
        expect(activeAgentUnit({ activityLabel: 'Editing files · 3m' })).toBe('Editing files · 3m');
    });
});
