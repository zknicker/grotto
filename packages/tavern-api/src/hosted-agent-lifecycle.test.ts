import { describe, expect, test } from 'bun:test';
import { hostedAgentLifecycleEventSchema } from './hosted-agent.ts';

const base = {
    agentId: 'agt_test',
    chatId: 'cht_test',
    emittedAt: '2026-07-29T12:00:00.000Z',
    runId: 'run_test',
    serverId: 'srv_test',
};

describe('hosted Agent lifecycle contract', () => {
    test.each(['working', 'reading'] as const)('accepts the %s phase', (phase) => {
        expect(hostedAgentLifecycleEventSchema.parse({ ...base, phase })).toEqual({
            ...base,
            phase,
        });
    });

    test('requires composition identity and text only while sending', () => {
        expect(
            hostedAgentLifecycleEventSchema.parse({
                ...base,
                compositionId: 'cmp_test',
                phase: 'sending',
                text: 'Draft response',
            })
        ).toMatchObject({ compositionId: 'cmp_test', phase: 'sending' });
        expect(
            hostedAgentLifecycleEventSchema.safeParse({
                ...base,
                phase: 'sending',
                text: 'Draft response',
            }).success
        ).toBe(false);
        expect(
            hostedAgentLifecycleEventSchema.safeParse({
                ...base,
                phase: 'reading',
                text: 'This must not become transcript evidence.',
            }).success
        ).toBe(false);
    });

    test('settlement names its terminal outcome', () => {
        expect(
            hostedAgentLifecycleEventSchema.parse({
                ...base,
                outcome: 'failed',
                phase: 'settled',
            })
        ).toMatchObject({ outcome: 'failed', phase: 'settled' });
    });
});
