import { expect, test } from 'bun:test';
import { hostedAgentCommandSchema, hostedCoveApplyResultSchema } from './hosted-agent-runner.ts';

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

test('Cove application uses one explicit factory command and durable result', () => {
    const command = {
        agentDescription: 'Onboarding Assistant',
        agentId: 'agt_cove',
        agentName: 'Cove',
        applicationId: 'cap_application',
        factoryKind: 'cove',
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        sessionGeneration: 1,
        type: 'cove-apply',
    } as const;
    expect(hostedAgentCommandSchema.parse(command)).toEqual(command);
    expect(hostedAgentCommandSchema.safeParse({ ...command, archetype: 'operator' }).success).toBe(
        false
    );
    expect(
        hostedCoveApplyResultSchema.parse({
            agentId: command.agentId,
            applicationId: command.applicationId,
            factoryKind: 'cove',
            status: 'applied',
            type: 'cove-apply-result',
        })
    ).toMatchObject({ status: 'applied' });
});
