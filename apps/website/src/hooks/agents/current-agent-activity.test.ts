import { expect, test } from 'bun:test';
import type { AgentActivityEvent } from '@tavern/api';
import {
    applyCurrentAgentActivityEvent,
    filterCurrentAgentActivityByAvailability,
    formatCurrentAgentActivityLabel,
    projectCurrentAgentActivitySnapshot,
    reconcileCurrentAgentActivity,
    splitCurrentAgentActivity,
} from './current-agent-activity.ts';

function activity(overrides: Partial<AgentActivityEvent> = {}): AgentActivityEvent {
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

test('semantic completion falls back to working until the Server settles the turn', () => {
    const active = activity();
    const betweenTools = applyCurrentAgentActivityEvent(
        [active],
        activity({
            category: 'checking_messages',
            id: 'aev_done',
            phase: 'completed',
            position: 2,
            producer: 'computer',
        })
    );

    expect(betweenTools).toEqual([
        activity({
            category: 'working',
            id: 'aev_done',
            phase: 'started',
            position: 2,
            producer: 'computer',
        }),
    ]);

    const afterSend = applyCurrentAgentActivityEvent(
        betweenTools,
        activity({
            category: 'sending_message',
            id: 'aev_send_done',
            phase: 'completed',
            position: 3,
            producer: 'server',
        })
    );

    expect(afterSend[0]?.category).toBe('working');

    const afterFailedTool = applyCurrentAgentActivityEvent(
        afterSend,
        activity({
            category: 'running_command',
            id: 'aev_tool_failed',
            phase: 'failed',
            position: 4,
            producer: 'computer',
        })
    );

    expect(afterFailedTool[0]?.category).toBe('working');

    const settled = applyCurrentAgentActivityEvent(
        afterFailedTool,
        activity({
            category: 'working',
            id: 'aev_settled',
            phase: 'completed',
            position: 5,
            producer: 'server',
        })
    );

    expect(settled).toEqual([]);
    expect(
        applyCurrentAgentActivityEvent(
            afterFailedTool,
            activity({
                category: 'working',
                id: 'aev_failed_turn',
                phase: 'failed',
                position: 5,
                producer: 'server',
            })
        )
    ).toEqual([]);
});

test('reconnect snapshots keep accepted runs working between semantic operations', () => {
    expect(
        projectCurrentAgentActivitySnapshot([
            activity({ id: 'aev_done', phase: 'completed', position: 2 }),
        ])
    ).toEqual([
        activity({
            category: 'working',
            id: 'aev_done',
            phase: 'started',
            position: 2,
        }),
    ]);
});

test('a live accepted run survives an older empty snapshot response', () => {
    expect(reconcileCurrentAgentActivity([], [activity({ category: 'starting_work' })])).toEqual([
        activity({ category: 'starting_work' }),
    ]);
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

test('semantic activity never overrides canonical Agent availability', () => {
    const activities = [activity(), activity({ agentId: 'agt_two', runId: 'run_two' })];

    expect(
        filterCurrentAgentActivityByAvailability(activities, [
            { availability: 'offline', id: 'agt_one' },
            { availability: 'working', id: 'agt_two' },
        ])
    ).toEqual([activities[1]]);
    expect(
        filterCurrentAgentActivityByAvailability(activities, [
            { availability: 'error', id: 'agt_one' },
            { availability: 'stopped', id: 'agt_two' },
        ])
    ).toEqual([]);
});
