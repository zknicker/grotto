import { describe, expect, test } from 'bun:test';
import { withTemporaryAgentConfiguration } from './test-support.mjs';

describe('Agent scenario configuration isolation', () => {
    test('restores the exact original runtime and model when an operation fails', async () => {
        const calls = [];
        const harness = {
            configureAgent: async (_agent, runtimeId, modelId) => {
                calls.push({ modelId, runtimeId });
            },
        };
        const cove = {
            desiredModelId: 'gpt-5.6-sol',
            desiredRuntimeId: 'codex',
        };
        const terra = { modelId: 'gpt-5.6-terra', runtimeId: 'codex' };

        await expect(
            withTemporaryAgentConfiguration(harness, cove, terra, async () => {
                throw new Error('scenario assertion failed');
            })
        ).rejects.toThrow('scenario assertion failed');

        expect(calls).toEqual([
            { modelId: terra.modelId, runtimeId: terra.runtimeId },
            { modelId: cove.desiredModelId, runtimeId: cove.desiredRuntimeId },
        ]);
    });

    test('leaves the Agent untouched when the target already matches', async () => {
        const calls = [];
        const harness = {
            configureAgent: async (_agent, runtimeId, modelId) => {
                calls.push({ modelId, runtimeId });
            },
        };
        const cove = { desiredModelId: 'gpt-5.6-sol', desiredRuntimeId: 'codex' };

        const result = await withTemporaryAgentConfiguration(
            harness,
            cove,
            { modelId: 'gpt-5.6-sol', runtimeId: 'codex' },
            async () => 'ran'
        );

        expect(result).toBe('ran');
        expect(calls).toEqual([]);
    });
});
