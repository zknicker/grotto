import { expect, test } from 'bun:test';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { pollAgentReply } from './task-replies.ts';

type EvalHarness = Awaited<ReturnType<typeof createEvalHarness>>;

test('pollAgentReply fails when durable activity proves the requested turn settled', async () => {
    const harness = {
        readMessages: async () => [
            {
                author: { kind: 'user' },
                content: 'Prompt',
                createdAt: '2026-08-12T17:00:00.000Z',
                sequence: 1,
            },
        ],
        serverId: 'srv_test',
        trpc: async (procedure: string) => {
            if (procedure === 'task.list') {
                return [];
            }
            if (procedure === 'agent.deliveryState') {
                return {
                    agentId: 'agt_test',
                    pending: 0,
                    running: false,
                    stopped: false,
                };
            }
            if (procedure === 'agent.activity') {
                return [
                    {
                        endedAt: '2026-08-12T17:00:02.000Z',
                        messageCount: 0,
                        runId: 'run_test',
                        startedAt: '2026-08-12T17:00:01.000Z',
                        status: 'completed',
                        summary: 'Sent no messages.',
                    },
                ];
            }
            throw new Error(`Unexpected procedure: ${procedure}`);
        },
    } as unknown as EvalHarness;

    const startedAt = Date.now();
    await expect(
        pollAgentReply(harness, 'cht_test', 'agt_test', 'Prompt', () => false)
    ).rejects.toThrow('settled without a matching reply');
    expect(Date.now() - startedAt).toBeLessThan(1000);
});
