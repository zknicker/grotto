import { afterEach, beforeEach, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessAgent } from '@ai-sdk/harness/agent';
import { composeInboxNotice } from '../inbox-format.ts';
import { acceptRunInbox, replacePendingInbox } from '../inbox-store.ts';
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
    refreshInstructions: boolean;
    resumeFrom: unknown;
    sessionId: string;
}

let agentRoot: string;
let acceptsUserMessages: boolean;
let createSessionCalls: CreateSessionCall[];
let restore: () => void;
let rejectResume: boolean;
let sentUserMessages: string[];
let stoppedSessions: number;
let streamIncludesToolBoundary: boolean;
let streamedPrompts: string[];
let streamToolNames: string[];

beforeEach(async () => {
    agentRoot = await mkdtemp(join(tmpdir(), 'grotto-harness-'));
    acceptsUserMessages = true;
    createSessionCalls = [];
    rejectResume = false;
    sentUserMessages = [];
    stoppedSessions = 0;
    streamIncludesToolBoundary = false;
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
                refreshInstructions: hasInstructionRefresh(options.resumeFrom),
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
                    return acceptsUserMessages;
                },
                sessionId: 'engine_session_1',
                stop: async () => {
                    stoppedSessions += 1;
                    return {
                        data: { nativeSessionId: 'native_session_1' },
                        harnessId: 'fake',
                        type: 'resume-session',
                    };
                },
            };
        }) as unknown as HarnessAgent['createSession'],
        stream: (async (options: { prompt: string }) => {
            streamedPrompts.push(options.prompt);
            return {
                fullStream: (async function* () {
                    for (const toolName of streamToolNames) {
                        yield { toolName, type: 'tool-call' };
                    }
                    if (streamIncludesToolBoundary) {
                        yield { type: 'tool-result' };
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

function hasInstructionRefresh(resumeFrom: unknown): boolean {
    if (
        typeof resumeFrom !== 'object' ||
        resumeFrom === null ||
        !('data' in resumeFrom) ||
        typeof resumeFrom.data !== 'object' ||
        resumeFrom.data === null
    ) {
        return false;
    }
    return 'refreshInstructions' in resumeFrom.data && resumeFrom.data.refreshInstructions === true;
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
        inboxDelivery: 'concrete',
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        sessionGeneration: 1,
        skillsDir: join(agentRoot, 'skills'),
        totalPending: 1,
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
    expect(streamedPrompts[0]).toContain(
        '[target=dm:@operator msg=test time=2026-07-27 00:00:00 type=human] @operator: Hello Cove'
    );
    expect(streamedPrompts).toHaveLength(1);
    expect(sentUserMessages).toEqual([]);

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

test('projects tool stream boundaries into safe semantic activity', async () => {
    streamToolNames = ['cat_private_file'];
    streamIncludesToolBoundary = true;
    const activity: Array<{ category: string; phase: string }> = [];

    await runHarnessTurn(turnInput({ onActivity: (event) => activity.push(event) }));

    expect(activity).toEqual([
        { category: 'thinking', phase: 'started' },
        { category: 'using_tool', phase: 'started' },
        { category: 'using_tool', phase: 'completed' },
        { category: 'thinking', phase: 'completed' },
    ]);
});

test('uses a concrete cold inbox as the first prompt without mid-turn injection', async () => {
    acceptsUserMessages = false;

    await runHarnessTurn(turnInput());

    expect(streamedPrompts[0]).toContain('Hello Cove');
    expect(sentUserMessages).toEqual([]);
});

test('cold-starts ordinary Chat work with a content-free notice in the same task', async () => {
    const input = turnInput({ inboxDelivery: 'notice' });
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(
        join(runtimeDir, 'pending-notice.json'),
        JSON.stringify({ notice: composeInboxNotice(input.inbox, input.totalPending) })
    );
    await runHarnessTurn(input);

    expect(streamedPrompts).toHaveLength(1);
    expect(streamedPrompts[0]).toContain('Grotto inbox notice');
    expect(streamedPrompts[0]).toContain('dm:@operator  pending: 1 message');
    expect(streamedPrompts[0]).not.toContain('Hello Cove');
    expect(sentUserMessages).toEqual([]);
});

test('a warm notice prompt is not injected a second time from durable storage', async () => {
    await runHarnessTurn(turnInput());
    sentUserMessages = [];
    streamedPrompts = [];
    const input = turnInput({ inboxDelivery: 'notice' });
    const notice = composeInboxNotice(input.inbox, input.totalPending);
    if (!notice) {
        throw new Error('Expected a notice.');
    }
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(join(runtimeDir, 'pending-notice.json'), JSON.stringify({ notice }));

    await runHarnessTurn(input);

    expect(streamedPrompts).toEqual([notice]);
    expect(sentUserMessages).toEqual([]);
    await expect(access(join(runtimeDir, 'pending-notice.json'))).rejects.toThrow();
});

test('an empty warm replay resumes without fabricating an inbox notice', async () => {
    await runHarnessTurn(turnInput());
    streamedPrompts = [];

    await runHarnessTurn(turnInput({ inbox: [], inboxDelivery: 'notice', totalPending: 0 }));

    expect(streamedPrompts).toEqual(['Resume the interrupted turn.']);
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
    expect(streamedPrompts[1]).toContain(
        'Fresh session: your previous conversation context is gone.'
    );
    expect(streamedPrompts[1]).toContain('Hello Cove');
});

test('Restart resumes the same session and refreshes its current instructions once', async () => {
    await runHarnessTurn(turnInput());
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(join(runtimeDir, 'restart-requested'), '');

    await runHarnessTurn(turnInput());

    expect(createSessionCalls[1]).toMatchObject({
        refreshInstructions: false,
        sessionId: 'engine_session_1',
    });
    expect(createSessionCalls[2]).toMatchObject({
        refreshInstructions: true,
        sessionId: 'engine_session_1',
    });
    expect(createSessionCalls[2]?.resumeFrom).toMatchObject({
        data: { nativeSessionId: 'native_session_1', refreshInstructions: true },
        type: 'resume-session',
    });
    expect(stoppedSessions).toBe(1);
    expect((await readSession()).generation).toBe(1);
    await expect(access(join(runtimeDir, 'restart-requested'))).rejects.toThrow();

    await runHarnessTurn(turnInput());
    expect(createSessionCalls[3]?.refreshInstructions).toBe(false);
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
    await runHarnessTurn(turnInput());
    sentUserMessages = [];
    streamIncludesToolBoundary = true;
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    const notice =
        '[Grotto inbox notice:\nInbox update: 3 unread messages total; 1 changed target\ndm:@operator  pending: 3 messages\n]';
    await writeFile(join(runtimeDir, 'pending-notice.json'), JSON.stringify({ notice }));
    let registeredSink: ((notice: string) => Promise<boolean>) | undefined;
    let unregistered = false;

    await runHarnessTurn(
        turnInput({
            inbox: [],
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

test('reports a busy notice delivered after the start ack and before sink registration', async () => {
    await runHarnessTurn(turnInput());
    sentUserMessages = [];
    streamIncludesToolBoundary = true;
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    const notice = '[Grotto inbox notice:\nInbox update: 1 unread messages total\n]';
    await writeFile(
        join(runtimeDir, 'pending-notice.json'),
        JSON.stringify({
            notice,
            receipt: { messageIds: ['msg_late'], runId: 'run_active' },
        })
    );
    const receipts: Array<{ messageIds: string[]; runId: string }> = [];

    await runHarnessTurn(
        turnInput({
            inbox: [],
            onStoredNoticeDelivered: (receipt) => receipts.push(receipt),
            totalPending: 0,
        })
    );

    expect(sentUserMessages).toEqual([notice]);
    expect(receipts).toEqual([{ messageIds: ['msg_late'], runId: 'run_active' }]);
});

test('leaves a late busy notice unacknowledged when no safe tool boundary remains', async () => {
    await runHarnessTurn(turnInput());
    sentUserMessages = [];
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    const notice = '[Grotto inbox notice:\nInbox update: 1 unread message total\n]';
    await writeFile(
        join(runtimeDir, 'pending-notice.json'),
        JSON.stringify({
            notice,
            receipt: { messageIds: ['msg_late'], runId: 'run_active' },
        })
    );
    const receipts: Array<{ messageIds: string[]; runId: string }> = [];

    await runHarnessTurn(
        turnInput({
            inbox: [],
            onStoredNoticeDelivered: (receipt) => receipts.push(receipt),
            totalPending: 0,
        })
    );

    expect(sentUserMessages).toEqual([]);
    expect(receipts).toEqual([]);
    await expect(access(join(runtimeDir, 'pending-notice.json'))).resolves.toBeNull();
});

test('defers a stored follow-up notice until the cold turn has a safe live boundary', async () => {
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    const notice =
        '[Grotto inbox notice:\nInbox update: 1 unread message total; 1 changed target\n#product  pending: 1 message\n]';
    await writeFile(join(runtimeDir, 'pending-notice.json'), JSON.stringify({ notice }));

    await runHarnessTurn(turnInput());

    expect(streamedPrompts[0]).toContain('Hello Cove');
    expect(sentUserMessages).toEqual([]);
    await expect(access(join(runtimeDir, 'pending-notice.json'))).resolves.toBeNull();

    streamIncludesToolBoundary = true;
    await runHarnessTurn(turnInput({ inbox: [], inboxDelivery: 'notice', totalPending: 0 }));

    expect(sentUserMessages).toEqual([notice]);
    await expect(access(join(runtimeDir, 'pending-notice.json'))).rejects.toThrow();
});

test('a resumed DM greeting is not followed by its stale notice from prior task context', async () => {
    const dataRoot = agentRoot;
    const serverId = 'srv_executor_test';
    const resumedRoot = join(dataRoot, 'servers', serverId, 'agents', 'agt_test');
    await mkdir(resumedRoot, { recursive: true });
    const scopedTurn = (inbox: HarnessTurnInput['inbox']) =>
        turnInput({
            agentRoot: resumedRoot,
            homeDir: join(resumedRoot, 'home'),
            inbox,
            skillsDir: join(resumedRoot, 'skills'),
            workspaceDir: join(resumedRoot, 'workspace'),
        });
    await runHarnessTurn(
        scopedTurn([
            {
                chatId: 'cht_product',
                content: 'Upload the new avatar when the app path arrives.',
                createdAt: '2026-08-03T20:00:00.000Z',
                id: 'msg_avatar_task',
                senderHandle: 'operator',
                senderType: 'human',
                sequence: 1,
                target: '#product',
            },
        ])
    );
    sentUserMessages = [];
    const greeting = {
        chatId: 'cht_dm',
        content: 'Hey Blippy!',
        createdAt: '2026-08-03T20:01:00.000Z',
        id: 'msg_dm_greeting',
        senderHandle: 'operator',
        senderType: 'human' as const,
        sequence: 1,
        target: 'dm:@operator',
    };
    const location = { agentId: 'agt_test', dataRoot, serverId };
    await replacePendingInbox(location, [greeting]);
    await acceptRunInbox(location, 'run_greeting', [greeting]);

    await runHarnessTurn(scopedTurn([greeting]));

    expect(createSessionCalls.at(-1)?.resumeFrom).toMatchObject({ type: 'resume-session' });
    expect(streamedPrompts.at(-1)).toContain(
        '[target=dm:@operator msg=dm_greet time=2026-08-03 20:01:00 type=human] @operator: Hey Blippy!'
    );
    expect(streamedPrompts.at(-1)).not.toContain('avatar');
    expect(sentUserMessages).toEqual([]);
});
