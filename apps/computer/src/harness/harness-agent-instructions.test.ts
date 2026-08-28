import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessV1, HarnessV1PromptTurnOptions } from '@ai-sdk/harness';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createLocalTrustedSandboxProvider } from './sandbox.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('HarnessAgent supplies current instructions to a resumed native session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-harness-instructions-'));
    roots.push(root);
    const promptTurns: Array<{ instructions: string | undefined; isResume: boolean }> = [];
    const harness = createInstructionObservingHarness(promptTurns);
    const sandbox = createLocalTrustedSandboxProvider({ rootDir: root });
    const firstAgent = new HarnessAgent({
        harness,
        id: 'agt_instruction_test',
        instructions: 'managed instructions v1',
        sandbox,
    });
    const firstSession = await firstAgent.createSession({ sessionId: 'engine_session_1' });
    await consumeTurn(await firstAgent.stream({ prompt: 'first', session: firstSession }));
    const resumeFrom = await firstSession.detach();
    const secondAgent = new HarnessAgent({
        harness,
        id: 'agt_instruction_test',
        instructions: 'managed instructions v2',
        sandbox,
    });
    const resumedSession = await secondAgent.createSession({
        resumeFrom,
        sessionId: 'engine_session_1',
    });
    await consumeTurn(await secondAgent.stream({ prompt: 'second', session: resumedSession }));

    expect(resumedSession.sessionId).toBe('engine_session_1');
    expect(promptTurns).toEqual([
        { instructions: 'managed instructions v1', isResume: false },
        { instructions: 'managed instructions v2', isResume: true },
    ]);
    await resumedSession.destroy();
});

function createInstructionObservingHarness(
    promptTurns: Array<{ instructions: string | undefined; isResume: boolean }>
): HarnessV1 {
    return {
        builtinTools: {},
        doStart: async (startOptions) => {
            const isResume = startOptions.resumeFrom !== undefined;
            const lifecycleState = {
                data: {},
                harnessId: 'instruction-observer',
                specificationVersion: 'harness-v1',
                type: 'resume-session',
            } as const;
            return {
                doCompact: async () => undefined,
                doContinueTurn: async () => emptyPromptControl(),
                doDestroy: async () => undefined,
                doDetach: async () => lifecycleState,
                doPromptTurn: async (options: HarnessV1PromptTurnOptions) => {
                    promptTurns.push({ instructions: options.instructions, isResume });
                    options.emit({
                        finishReason: { raw: undefined, unified: 'stop' },
                        totalUsage: {
                            inputTokens: {
                                cacheRead: undefined,
                                cacheWrite: undefined,
                                noCache: 1,
                                total: 1,
                            },
                            outputTokens: { reasoning: undefined, text: 1, total: 1 },
                            raw: undefined,
                        },
                        type: 'finish',
                    });
                    return emptyPromptControl();
                },
                doStop: async () => lifecycleState,
                doSuspendTurn: async () => ({
                    data: {},
                    harnessId: 'instruction-observer',
                    specificationVersion: 'harness-v1',
                    type: 'continue-turn',
                }),
                isResume,
                sessionId: startOptions.sessionId,
            };
        },
        harnessId: 'instruction-observer',
        specificationVersion: 'harness-v1',
    };
}

function emptyPromptControl() {
    return {
        done: Promise.resolve(),
        submitToolResult: async () => undefined,
    };
}

async function consumeTurn(turn: { fullStream: AsyncIterable<unknown> }): Promise<void> {
    for await (const part of turn.fullStream) {
        void part;
    }
}
