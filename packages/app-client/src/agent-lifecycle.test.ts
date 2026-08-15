import { expect, test } from 'bun:test';
import type { Agent, AgentLifecycleEvent } from '@tavern/api';
import { compositionExpiryDelay, projectAgentAvailability } from './agent-lifecycle.tsx';

const cove = {
    availability: 'idle',
    id: 'agt_cove',
} as Agent;

const eventBase = {
    agentId: cove.id,
    chatId: 'cht_cove',
    emittedAt: '2026-08-14T16:30:00.000Z',
    runId: 'run_cove',
    serverId: 'srv_grotto',
} as const;

test('Agent availability stays working through every active lifecycle phase', () => {
    let agents = [cove];
    const activeEvents = [
        { ...eventBase, phase: 'working' },
        { ...eventBase, phase: 'reading' },
        {
            ...eventBase,
            compositionId: 'composition_cove',
            phase: 'sending',
            text: 'Working on it',
        },
    ] satisfies AgentLifecycleEvent[];

    for (const event of activeEvents) {
        agents = projectAgentAvailability(agents, event);
        expect(agents[0]?.availability).toBe('working');
    }

    agents = projectAgentAvailability(agents, {
        ...eventBase,
        outcome: 'completed',
        phase: 'settled',
    } satisfies AgentLifecycleEvent);
    expect(agents[0]?.availability).toBe('idle');
});

test.each([
    ['completed', 'idle'],
    ['failed', 'error'],
    ['stopped', 'stopped'],
] as const)('settled %s lifecycle projects %s availability', (outcome, availability) => {
    const event = {
        ...eventBase,
        outcome,
        phase: 'settled',
    } satisfies AgentLifecycleEvent;
    expect(projectAgentAvailability([cove], event)[0]?.availability).toBe(availability);
});

test('sending composition expiry is one-shot and measured from emission time', () => {
    expect(
        compositionExpiryDelay('2026-07-29T12:00:00.000Z', Date.parse('2026-07-29T12:00:05Z'))
    ).toBe(7000);
    expect(
        compositionExpiryDelay('2026-07-29T12:00:00.000Z', Date.parse('2026-07-29T12:01:00Z'))
    ).toBe(0);
});
