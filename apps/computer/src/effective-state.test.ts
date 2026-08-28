import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readEffectiveAgentStates } from './effective-state.ts';
import { writeAgentSessionState } from './harness/session-store.ts';

let root: string | null = null;

afterEach(async () => {
    if (root) {
        await rm(root, { force: true, recursive: true });
        root = null;
    }
});

test('effective-state reports are derived from durable per-Agent sessions', async () => {
    root = await mkdtemp(join(tmpdir(), 'grotto-effective-state-'));
    const agentsRoot = join(root, 'servers', 'srv_test', 'agents');
    const appliedRoot = join(agentsRoot, 'agt_applied');
    await mkdir(appliedRoot, { recursive: true });
    await writeAgentSessionState(appliedRoot, {
        bootstrapFingerprint: 'bootstrap_current',
        cumulativeTokenUsage: null,
        effectiveModel: { modelId: 'gpt-5.6-sol', runtimeId: 'codex' },
        generation: 1,
        instructionFingerprint: 'instructions_current',
        resumeState: { threadId: 'thread-local' },
        runtimeSessionId: 'session-local',
    });
    await mkdir(join(agentsRoot, 'agt_missing'), { recursive: true });

    expect(await readEffectiveAgentStates(root, 'srv_test')).toEqual([
        {
            agentId: 'agt_applied',
            missingResources: [],
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
        },
        {
            agentId: 'agt_missing',
            missingResources: ['session'],
            modelId: null,
            runtimeId: null,
        },
    ]);
});
