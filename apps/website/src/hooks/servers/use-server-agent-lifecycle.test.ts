import { expect, test } from 'bun:test';
import type { HostedAgent, HostedAgentLifecycleEvent } from '@tavern/api';
import {
    hostedCompositionExpiryDelay,
    projectHostedAgentAvailability,
} from './use-server-agent-lifecycle.ts';

const agent = {
    availability: 'idle',
    id: 'agt_test',
} as HostedAgent;

const base = {
    agentId: agent.id,
    chatId: 'cht_test',
    emittedAt: '2026-07-29T12:00:00.000Z',
    runId: 'run_test',
    serverId: 'srv_test',
} as const;

test('active lifecycle phases immediately project a working Agent', () => {
    const event = { ...base, phase: 'reading' } satisfies HostedAgentLifecycleEvent;
    expect(projectHostedAgentAvailability([agent], event)[0]?.availability).toBe('working');
});

test.each([
    ['completed', 'idle'],
    ['failed', 'error'],
    ['stopped', 'stopped'],
] as const)('settled %s lifecycle projects %s availability', (outcome, availability) => {
    const event = {
        ...base,
        outcome,
        phase: 'settled',
    } satisfies HostedAgentLifecycleEvent;
    expect(projectHostedAgentAvailability([agent], event)[0]?.availability).toBe(availability);
});

test('sending composition expiry is one-shot and measured from emission time', () => {
    expect(
        hostedCompositionExpiryDelay('2026-07-29T12:00:00.000Z', Date.parse('2026-07-29T12:00:05Z'))
    ).toBe(7000);
    expect(
        hostedCompositionExpiryDelay('2026-07-29T12:00:00.000Z', Date.parse('2026-07-29T12:01:00Z'))
    ).toBe(0);
});
