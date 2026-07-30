import { afterEach, beforeEach, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessAgent } from '@ai-sdk/harness/agent';
import {
    AgentSessionResumeRejectedError,
    type HarnessTurnInput,
    runHarnessTurn,
    setHarnessAgentFactoryForTesting,
} from './executor.ts';
import type { AgentSessionState } from './session-store.ts';

// Deterministic harness lane: a fake `@ai-sdk/harness` Agent stands in for the
// real Codex/Claude/Pi driver so the ported executor's one-session-per-Agent
// resume/reset/model-switch behavior is proven without a model call.

interface CreateSessionCall {
    resumeFrom: unknown;
    sessionId: string;
}

let agentRoot: string;
let createSessionCalls: CreateSessionCall[];
let restore: () => void;
let rejectResume: boolean;
let sentUserMessages: string[];
let streamedPrompts: string[];
let streamToolNames: string[];

beforeEach(async () => {
    agentRoot = await mkdtemp(join(tmpdir(), 'grotto-harness-'));
    createSessionCalls = [];
    rejectResume = false;
    sentUserMessages = [];
    streamedPrompts = [];
    streamToolNames = [];
    restore = setHarnessAgentFactoryForTesting((_input, _options) => fakeAgent());
});

afterEach(async () => {
    restore();
    await rm(agentRoot, { force: true, recursive: true });
});

function fakeAgent(): Pick<HarnessAgent, 'createSession' | 'stream'> {
    return {
        createSession: (async (options: { resumeFrom?: unknown; sessionId: string }) => {
            createSessionCalls.push({
                resumeFrom: options.resumeFrom,
                sessionId: options.sessionId,
            });
            if (options.resumeFrom && rejectResume) {
                throw new Error('runtime session gone');
            }
            return {
                detach: async () => ({ data: {}, harnessId: 'fake', type: 'resume-session' }),
                destroy: async () => undefined,
                isResume: Boolean(options.resumeFrom),
                sendUserMessage: async (message: string) => {
                    sentUserMessages.push(message);
                    return true;
                },
                sessionId: 'engine_session_1',
            };
        }) as unknown as HarnessAgent['createSession'],
        stream: (async (options: { prompt: string }) => {
            streamedPrompts.push(options.prompt);
            return {
                fullStream: (async function* () {
                    for (const toolName of streamToolNames) {
                        yield { toolName, type: 'tool-call' };
                    }
                    yield {
                        type: 'finish-step',
                        usage: { inputTokens: { total: 10 }, outputTokens: { total: 5 } },
                    };
                })(),
            };
        }) as unknown as HarnessAgent['stream'],
    };
}

function turnInput(overrides: Partial<HarnessTurnInput> = {}): HarnessTurnInput {
    return {
        agentId: 'agt_test',
        agentName: 'Cove',
        agentRoot,
        env: {},
        homeDir: join(agentRoot, 'home'),
        homeTimezone: 'UTC',
        initialRole: null,
        inbox: [
            {
                chatId: 'cht_test',
                content: 'Hello Cove',
                createdAt: '2026-07-27T00:00:00.000Z',
                id: 'msg_test',
                senderHandle: 'operator',
                senderType: 'human',
                sequence: 1,
                target: 'dm:@operator',
            },
        ],
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        sessionGeneration: 1,
        skillsDir: join(agentRoot, 'skills'),
        webAccess: null,
        workspaceDir: join(agentRoot, 'workspace'),
        ...overrides,
        tools: overrides.tools ?? {},
    };
}

async function readSession(): Promise<AgentSessionState> {
    return JSON.parse(await readFile(join(agentRoot, 'session.json'), 'utf8')) as AgentSessionState;
}

test('cold-starts a fresh Agent then resumes its one global session', async () => {
    const first = await runHarnessTurn(turnInput());
    expect(first.contextTokens).toBe(15);
    expect(first.toolNames).toEqual([]);
    // Cold start: no resume payload, generation 1, engine session + resume state
    // persisted for the next turn.
    expect(createSessionCalls[0]?.resumeFrom).toBeUndefined();
    const afterFirst = await readSession();
    expect(afterFirst.generation).toBe(1);
    expect(afterFirst.runtimeSessionId).toBe('engine_session_1');
    expect(afterFirst.resumeState).toMatchObject({ type: 'resume-session' });
    expect(streamedPrompts[0]).toContain('Start.');
    expect(streamedPrompts[1]).toContain(
        '[target=dm:@operator msg=test time=2026-07-27 00:00:00 type=human] @operator: Hello Cove'
    );

    await runHarnessTurn(turnInput());
    // Second turn resumes: the stored resume state is handed back to the engine.
    expect(createSessionCalls[1]?.resumeFrom).toMatchObject({ type: 'resume-session' });
    expect((await readSession()).generation).toBe(1);
});

test('returns bounded unique tool names as safe turn evidence', async () => {
    streamToolNames = [
        'mcp__catalog__get_issue',
        'mcp__catalog__get_issue',
        'shell_command',
        'read_file',
        'write_file',
        'search',
        'edit_file',
        'ignored_after_limit',
    ];

    const result = await runHarnessTurn(turnInput());

    expect(result.toolNames).toEqual([
        'mcp__catalog__get_issue',
        'shell_command',
        'read_file',
        'write_file',
        'search',
        'edit_file',
    ]);
});

test('a cold start removes only its stale unresumable harness run', async () => {
    const staleRun = join(agentRoot, '.agent-runs', 'agt_test-1');
    await mkdir(staleRun, { recursive: true });
    await writeFile(join(staleRun, 'stale'), 'old bridge');

    await runHarnessTurn(turnInput());

    await expect(access(join(staleRun, 'stale'))).rejects.toThrow();
});

test('a Server generation change cold-starts the assigned runtime and model', async () => {
    await runHarnessTurn(turnInput());
    await runHarnessTurn(
        turnInput({
            modelId: 'claude-opus-4-8',
            runtimeId: 'claude-code',
            sessionGeneration: 2,
        })
    );

    expect(createSessionCalls[1]?.resumeFrom).toBeUndefined();
    const session = await readSession();
    expect(session.generation).toBe(2);
    expect(session.effectiveModel).toEqual({
        modelId: 'claude-opus-4-8',
        runtimeId: 'claude-code',
    });
});

test('a rejected resume returns control to the Server without local rotation', async () => {
    await runHarnessTurn(turnInput());
    rejectResume = true;

    await expect(runHarnessTurn(turnInput())).rejects.toBeInstanceOf(
        AgentSessionResumeRejectedError
    );

    // The Server must authorize the next generation before a cold start.
    expect(createSessionCalls[1]?.resumeFrom).toMatchObject({ type: 'resume-session' });
    expect(createSessionCalls).toHaveLength(2);
    expect((await readSession()).generation).toBe(1);
});

test('delivers a pending busy notice into the live harness turn', async () => {
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    const notice =
        '[Grotto inbox notice:\nInbox update: 3 unread messages total; 1 changed target(s)\ndm:@operator pending: 3 message(s)\n]';
    await writeFile(join(runtimeDir, 'pending-notice.json'), JSON.stringify({ notice }));
    let registeredSink: ((notice: string) => Promise<boolean>) | undefined;
    let unregistered = false;

    await runHarnessTurn(
        turnInput({
            registerNoticeSink: (sink) => {
                registeredSink = sink;
                return () => {
                    unregistered = true;
                };
            },
        })
    );

    expect(registeredSink).toBeDefined();
    expect(sentUserMessages).toEqual([notice]);
    expect(unregistered).toBe(true);
    await expect(access(join(runtimeDir, 'pending-notice.json'))).rejects.toThrow();
});
