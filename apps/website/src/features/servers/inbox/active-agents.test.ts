import { describe, expect, test } from 'bun:test';
import type { Agent, AgentRecentTurn } from '@grotto/api';
import {
    type ActiveAgent,
    activeAgentUnit,
    groupTurnsByAgent,
    rankActiveAgents,
    toActiveAgent,
} from './active-agents.ts';

const now = Date.parse('2025-05-08T15:00:00.000Z');

function agent(id: string, displayName: string): Agent {
    return {
        availability: 'idle',
        avatarUrl: null,
        displayName,
        id,
    } as Agent;
}

function entry(name: string, turnCount: number, activityLabel: null | string = null): ActiveAgent {
    return { activityLabel, agent: agent(name, name), days: [], turnCount };
}

function turn(agentId: string, startedAt: string): AgentRecentTurn {
    return {
        agentId,
        endedAt: startedAt,
        runId: `run_${agentId}_${startedAt}`,
        startedAt,
        status: 'completed',
    };
}

describe('groupTurnsByAgent', () => {
    test('splits one Server-wide window into per-Agent weeks', () => {
        const grouped = groupTurnsByAgent([
            turn('agt_1', '2025-05-08T09:00:00.000Z'),
            turn('agt_2', '2025-05-08T08:00:00.000Z'),
            turn('agt_1', '2025-05-07T09:00:00.000Z'),
        ]);

        expect(grouped.get('agt_1')?.map((entry) => entry.startedAt)).toEqual([
            '2025-05-08T09:00:00.000Z',
            '2025-05-07T09:00:00.000Z',
        ]);
        expect(grouped.get('agt_2')).toHaveLength(1);
    });

    test('an Agent with no turns in the window is absent, not empty', () => {
        const grouped = groupTurnsByAgent([turn('agt_1', '2025-05-08T09:00:00.000Z')]);

        expect(grouped.has('agt_2')).toBe(false);
        expect(
            toActiveAgent(agent('agt_2', 'Quiet'), grouped.get('agt_2'), null, now).turnCount
        ).toBe(0);
    });

    test('an empty window groups to nothing', () => {
        expect(groupTurnsByAgent([]).size).toBe(0);
    });
});

describe('toActiveAgent', () => {
    test('counts the turns in the window it draws', () => {
        const result = toActiveAgent(
            agent('agt_1', 'Blippy'),
            [
                { startedAt: '2025-05-08T09:00:00.000Z' },
                { startedAt: '2025-05-08T11:00:00.000Z' },
                { startedAt: '2025-05-06T11:00:00.000Z' },
                // Older than the window, so it is neither drawn nor counted.
                { startedAt: '2025-01-01T11:00:00.000Z' },
            ],
            null,
            now
        );

        expect(result.turnCount).toBe(3);
        expect(result.days).toHaveLength(7);
        expect(result.days.reduce((total, count) => total + count, 0)).toBe(3);
    });

    test('an unsettled turn read counts nothing rather than guessing', () => {
        expect(toActiveAgent(agent('agt_1', 'Blippy'), undefined, null, now).turnCount).toBe(0);
    });
});

describe('rankActiveAgents', () => {
    test('drops the Agents with no week and nothing running', () => {
        expect(
            rankActiveAgents([entry('Quiet', 0), entry('Busy', 3)]).map((e) => e.agent.displayName)
        ).toEqual(['Busy']);
    });

    test('keeps a working Agent that has not finished a turn yet', () => {
        expect(
            rankActiveAgents([entry('Working', 0, 'Editing files · 3m')]).map(
                (e) => e.agent.displayName
            )
        ).toEqual(['Working']);
    });

    test('working first, then the busiest week, then the name', () => {
        expect(
            rankActiveAgents([
                entry('Cove', 9),
                entry('Tiny', 2, 'Reading files · 1m'),
                entry('Amber', 4),
                entry('Zephyr', 4),
            ]).map((e) => e.agent.displayName)
        ).toEqual(['Tiny', 'Cove', 'Amber', 'Zephyr']);
    });

    test('caps the strip', () => {
        const many = Array.from({ length: 20 }, (_, index) => entry(`Agent ${index}`, index + 1));
        expect(rankActiveAgents(many)).toHaveLength(8);
        expect(rankActiveAgents(many, 3)).toHaveLength(3);
    });
});

describe('activeAgentUnit', () => {
    test('names what the figure counts', () => {
        expect(activeAgentUnit({ activityLabel: null, turnCount: 4 })).toBe('turns · 7d');
        expect(activeAgentUnit({ activityLabel: null, turnCount: 1 })).toBe('turn · 7d');
    });

    test('a working Agent spends the line on its step instead', () => {
        expect(activeAgentUnit({ activityLabel: 'Editing files · 3m', turnCount: 4 })).toBe(
            'Editing files · 3m'
        );
    });
});
