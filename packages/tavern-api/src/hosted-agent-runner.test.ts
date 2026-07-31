import { expect, test } from 'bun:test';
import { hostedAgentCommandSchema } from './hosted-agent-runner.ts';

test('hosted Agent restart carries only the Agent identity', () => {
    expect(
        hostedAgentCommandSchema.parse({
            agentId: 'agt_restart',
            type: 'agent-restart',
        })
    ).toEqual({
        agentId: 'agt_restart',
        type: 'agent-restart',
    });
    expect(
        hostedAgentCommandSchema.safeParse({
            agentId: 'agt_restart',
            sessionGeneration: 2,
            type: 'agent-restart',
        }).success
    ).toBe(false);
});
