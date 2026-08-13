import { expect, test } from 'bun:test';
import { agentCommandSchema, coveApplyResultSchema } from './agent-runner.ts';

test('hosted Agent restart carries only the Agent identity', () => {
    expect(
        agentCommandSchema.parse({
            agentId: 'agt_restart',
            type: 'agent-restart',
        })
    ).toEqual({
        agentId: 'agt_restart',
        type: 'agent-restart',
    });
    expect(
        agentCommandSchema.safeParse({
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
    expect(agentCommandSchema.parse(command)).toEqual(command);
    expect(agentCommandSchema.safeParse({ ...command, archetype: 'operator' }).success).toBe(false);
    expect(
        coveApplyResultSchema.parse({
            agentId: command.agentId,
            applicationId: command.applicationId,
            factoryKind: 'cove',
            status: 'applied',
            type: 'cove-apply-result',
        })
    ).toMatchObject({ status: 'applied' });
});
