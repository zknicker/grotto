import { expect, test } from 'bun:test';
import {
    type AgentActionAttention,
    agentStartCommandSchema,
    agentTurnSummarySchema,
} from '@grotto/api';
import { dispatchAgentStart } from './agent-start-dispatch.ts';
import { type AgentStartCommand, type AgentTurnFrame, parseStartCommand } from './launch.ts';

test('dispatches the Server creation continuation without a created Agent chat id', async () => {
    const command = creationContinuation();
    const started: AgentStartCommand[] = [];
    const failures: AgentTurnFrame[] = [];
    await dispatchAgentStart(command, {
        coordinator: { waitForConfiguration: async () => undefined },
        send: (failure) => {
            failures.push(failure);
            return true;
        },
        start: (accepted) => {
            started.push(accepted);
        },
    });
    expect(parseStartCommand(command)).toEqual(command);
    expect(started).toEqual([command]);
    expect(failures).toEqual([]);
});

test('reports a terminal failure for a rejected start without leaking its payload', async () => {
    const command = { ...creationContinuation(), inbox: [{ content: 'private payload' }] };
    const started: AgentStartCommand[] = [];
    const failures: AgentTurnFrame[] = [];
    await dispatchAgentStart(command, {
        coordinator: { waitForConfiguration: async () => undefined },
        send: (failure) => {
            failures.push(failure);
            return true;
        },
        start: (accepted) => {
            started.push(accepted);
        },
    });
    expect(started).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(agentTurnSummarySchema.parse(failures[0])).toMatchObject({
        agentId: command.agentId,
        runId: command.runId,
        failureKind: 'configuration',
        status: 'failed',
        outputProduced: false,
        visibleMessages: [],
    });
    expect(JSON.stringify(failures)).not.toContain('private payload');
});

function creationContinuation() {
    const actionAttention: AgentActionAttention = {
        actionId: 'act_create_agent',
        chatId: 'cht_origin',
        createdAgentId: 'agt_created',
        executedResult: {
            agentId: 'agt_created',
            avatarUrl: null,
            computerId: 'cmp_local',
            description: null,
            displayName: 'Scout',
            handle: 'scout',
            modelId: 'gpt-5.6-sol',
            reasoningEffort: 'medium',
            role: 'member',
            runtimeId: 'codex',
        },
        kind: 'agent:create',
    };
    return agentStartCommandSchema.parse({
        agentId: 'agt_cove',
        chatId: 'cht_origin',
        inbox: [
            {
                actionAttention,
                chatId: 'cht_origin',
                content: '',
                createdAt: '2026-09-08T03:47:39.214Z',
                id: actionAttention.actionId,
                senderHandle: 'grotto',
                senderType: 'system',
                sequence: 0,
                target: '@operator',
            },
        ],
        inboxDelivery: 'concrete',
        modelId: 'gpt-5.6-sol',
        runId: 'run_continuation',
        runtimeId: 'codex',
        sessionGeneration: 1,
        totalPending: 0,
        type: 'start',
    });
}
