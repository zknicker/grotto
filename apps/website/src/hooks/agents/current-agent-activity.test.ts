import { expect, test } from 'bun:test';
import type { HostedAgentActivityEvent } from '@tavern/api';
import {
    applyCurrentAgentActivityEvent,
    formatCurrentAgentActivityLabel,
    splitCurrentAgentActivity,
} from './current-agent-activity.ts';

function activity(overrides: Partial<HostedAgentActivityEvent> = {}): HostedAgentActivityEvent {
    return {
        agentId: 'agt_one',
        category: 'thinking',
        id: 'aev_one',
        occurredAt: '2026-08-11T12:00:00.000Z',
        phase: 'started',
        position: 1,
        producer: 'server',
        producerId: 'server',
        producerSequence: 1,
        runId: 'run_one',
        serverId: 'srv_one',
        ...overrides,
    };
}

test('category changes replace the row without changing turn order', () => {
    const oldest = activity();
    const newer = activity({
        agentId: 'agt_two',
        id: 'aev_two',
        runId: 'run_two',
    });
    const categoryChange = activity({
        category: 'editing_files',
        id: 'aev_three',
        position: 2,
    });

    const result = applyCurrentAgentActivityEvent(
        applyCurrentAgentActivityEvent([oldest, newer], categoryChange),
        activity({
            agentId: 'agt_three',
            id: 'aev_four',
            runId: 'run_three',
        })
    );

    expect(result.map((item) => item.agentId)).toEqual(['agt_one', 'agt_two', 'agt_three']);
    expect(result[0]?.category).toBe('editing_files');
});

test('settled activity removes the row instead of rendering a finished state', () => {
    const active = activity();
    const result = applyCurrentAgentActivityEvent(
        [active],
        activity({ id: 'aev_done', phase: 'completed', position: 2 })
    );

    expect(result).toEqual([]);
});

test('stale events cannot roll back a newer current category', () => {
    const current = activity({ category: 'editing_files', id: 'aev_two', position: 2 });
    const stale = activity({ id: 'aev_one', position: 1 });

    expect(applyCurrentAgentActivityEvent([current], stale)).toEqual([current]);
});

test('the strip renders four rows and counts the remaining active runs', () => {
    const activities = Array.from({ length: 5 }, (_, index) =>
        activity({
            agentId: `agt_${index + 1}`,
            id: `aev_${index + 1}`,
            runId: `run_${index + 1}`,
        })
    );

    expect(splitCurrentAgentActivity(activities)).toEqual({
        hiddenCount: 1,
        visible: activities.slice(0, 4),
    });
});

test('semantic activity labels use the product catalog', () => {
    expect(formatCurrentAgentActivityLabel(activity({ category: 'starting_work' }))).toBe(
        'Starting work…'
    );
    expect(formatCurrentAgentActivityLabel(activity({ category: 'running_command' }))).toBe(
        'Running a command…'
    );
    expect(formatCurrentAgentActivityLabel(activity({ category: 'using_tool' }))).toBe(
        'Using a tool…'
    );
});
