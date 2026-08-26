import { expect, test } from 'bun:test';
import { agentCommandSchema, agentInboxItemSchema, coveApplyResultSchema } from './agent-runner.ts';
import { agentCreateActionResultSchema } from './prepared-actions.ts';

test('Agent restart carries only the Agent identity', () => {
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

test('typed action attention carries the action identity and executed Agent result', () => {
    const result = agentCreateActionResultSchema.parse({
        agentId: 'agt_created',
        avatarUrl: null,
        computerId: 'cmp_local',
        description: 'A new teammate',
        displayName: 'Scout',
        handle: 'scout',
        modelId: 'gpt-5',
        reasoningEffort: 'medium',
        role: 'member',
        runtimeId: 'codex',
    });

    expect(
        agentInboxItemSchema.parse({
            actionAttention: {
                actionId: 'act_create_agent',
                chatId: 'cht_origin',
                createdAgentId: result.agentId,
                executedResult: result,
                kind: 'agent:create',
            },
            chatId: 'cht_origin',
            content: '',
            createdAt: '2026-08-26T12:00:00.000Z',
            id: 'act_create_agent',
            senderHandle: 'grotto',
            senderType: 'system',
            sequence: 0,
            target: '#product',
        })
    ).toMatchObject({
        actionAttention: {
            actionId: 'act_create_agent',
            createdAgentId: 'agt_created',
            kind: 'agent:create',
        },
        sequence: 0,
    });
});
