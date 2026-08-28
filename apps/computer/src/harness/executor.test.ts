import { afterEach, beforeEach, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessAgent } from '@ai-sdk/harness/agent';
import { seedCoveWorkspace } from '@grotto/agent-workspace';
import { composeInboxNotice } from '../inbox-format.ts';
import { acceptRunInbox, replacePendingInbox } from '../inbox-store.ts';
import { readClaudePlanUsageState } from '../usage/claude-plan-usage-state.ts';
import { readComputerExecutionJournal } from './execution-journal.ts';
import {
    AgentSessionResumeRejectedError,
    HarnessTurnFailedError,
    type HarnessTurnInput,
    runHarnessTurn,
    setHarnessAgentFactoryForTesting,
    setHarnessBootstrapRefreshForTesting,
} from './executor.ts';
import type { AgentSessionState } from './session-store.ts';

// Deterministic harness lane: a fake `@ai-sdk/harness` Agent stands in for the
// real Codex/Claude/Pi driver so the ported executor's one-session-per-Agent
// resume/reset/model-switch behavior is proven without a model call.

const legacyCoveFaq = `# Onboarding Knowledge FAQ

## What can Cove do?

Cove can collaborate in joined Chats, read Server-owned history through the Grotto CLI, work in this private workspace, use granted tools and skills, manage Tasks and reminders within current authority, and consult the shared Manual.

## What stays with the owner?

Owners and Admins create and administer Channels, Computers, members, roles, and external connections in the App. Cove should explain the next action and ask the owner to perform it when no Agent command exists.

## Where does history live?

Canonical Chat history lives on Grotto Server. Workspace notes are Cove's durable working memory, not a transcript mirror.

## Are Agents archetypes?

No. Agents have real identities and execution settings. Team lanes emerge through work; optional Manual cards can help design them.
`;

const legacyCovePlaybook = `# Onboarding Playbook

1. Start with the owner's concrete goal, not a feature tour.
2. Propose one useful next action and name who has authority to do it.
3. Use real Grotto capabilities only. Never invent unsupported UI affordances, local Chat ownership, or Agent-created Channels.
4. Keep suggestions optional after setup. Record postponements, refusals, and blockers in onboarding_objectives.md.
5. Retrieve a full procedure with \`grotto manual get <topic>\` when a seeded summary applies. For an Agent-creation request, retrieve \`recipes/playbook/agent-creation\` before composing the avatar, action, and continuation.
6. Preserve honest authorship: Cove's messages come from Cove turns, never setup machinery.
`;

interface CreateSessionCall {
    resumeFrom: unknown;
    sessionId: string;
}

let agentRoot: string;
let acceptsUserMessages: boolean;
let agentInstructions: string[];
let createSessionCalls: CreateSessionCall[];
let restore: () => void;
let restoreBootstrapRefresh: () => void;
let rejectResume: boolean;
let refreshedBootstraps: number;
let sentUserMessages: string[];
let stoppedSessions: number;
let streamIncludesToolBoundary: boolean;
let streamProviderMetadata: Record<string, unknown> | undefined;
let streamFails: boolean;
let streamUsageScale: number;
let streamedPrompts: string[];
let streamToolNames: string[];
let streamedCoveFaqs: Array<string | null>;
let streamedCovePlaybooks: Array<string | null>;

beforeEach(async () => {
    agentRoot = await mkdtemp(join(tmpdir(), 'grotto-harness-'));
    acceptsUserMessages = true;
    agentInstructions = [];
    createSessionCalls = [];
    rejectResume = false;
    refreshedBootstraps = 0;
    sentUserMessages = [];
    stoppedSessions = 0;
    streamIncludesToolBoundary = false;
    streamProviderMetadata = undefined;
    streamFails = false;
    streamUsageScale = 1;
    streamedPrompts = [];
    streamToolNames = [];
    streamedCoveFaqs = [];
    streamedCovePlaybooks = [];
    restore = setHarnessAgentFactoryForTesting((input, options) => {
        agentInstructions.push(options.instructions);
        return fakeAgent(input);
    });
    restoreBootstrapRefresh = setHarnessBootstrapRefreshForTesting(async () => {
        refreshedBootstraps += 1;
    });
});

afterEach(async () => {
    restore();
    restoreBootstrapRefresh();
    await rm(agentRoot, { force: true, recursive: true });
});

function fakeAgent(input: HarnessTurnInput): Pick<HarnessAgent, 'createSession' | 'stream'> {
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
            if (input.factoryKind === 'cove') {
                streamedCoveFaqs.push(
                    await readOptionalText(join(input.workspaceDir, 'onboarding_knowledge_faq.md'))
                );
                streamedCovePlaybooks.push(
                    await readOptionalText(join(input.workspaceDir, 'onboarding_playbook.md'))
                );
            }
            return {
                fullStream: (async function* () {
                    for (const [index, toolName] of streamToolNames.entries()) {
                        yield { toolCallId: `call_${index}`, toolName, type: 'tool-call' };
                    }
                    if (streamIncludesToolBoundary) {
                        if (streamToolNames.length === 0) {
                            yield { type: 'tool-result' };
                        } else {
                            for (const [index, toolName] of streamToolNames.entries()) {
                                yield {
                                    result: { ok: true },
                                    toolCallId: `call_${index}`,
                                    toolName,
                                    type: 'tool-result',
                                };
                            }
                        }
                    }
                    yield {
                        type: 'finish-step',
                        usage: streamFails ? publicUsage(streamUsageScale) : publicUsage(0),
                    };
                    if (streamFails) {
                        yield { error: new Error('provider failed'), type: 'error' };
                    } else {
                        yield {
                            providerMetadata: streamProviderMetadata,
                            totalUsage: publicUsage(streamUsageScale),
                            type: 'finish',
                        };
                    }
                })(),
            };
        }) as unknown as HarnessAgent['stream'],
    };
}

async function readOptionalText(path: string): Promise<string | null> {
    return await readFile(path, 'utf8').catch((error: unknown) => {
        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
        ) {
            return null;
        }
        throw error;
    });
}

function publicUsage(scale = 1) {
    return {
        inputTokenDetails: {
            cacheReadTokens: 8 * scale,
            cacheWriteTokens: 2 * scale,
            noCacheTokens: 2 * scale,
        },
        inputTokens: 10 * scale,
        outputTokenDetails: { reasoningTokens: undefined, textTokens: 5 * scale },
        outputTokens: 5 * scale,
        raw: undefined,
        totalTokens: 15 * scale,
    };
}

function turnInput(overrides: Partial<HarnessTurnInput> = {}): HarnessTurnInput {
    return {
        agentId: 'agt_test',
        agentName: 'Cove',
        agentRoot,
        dataRoot: agentRoot,
        env: {},
        factoryKind: 'ordinary',
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
        reasoningEffort: 'medium',
        runId: 'run_test',
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
    expect(first.tokenUsage).toEqual({
        cacheReadTokens: 8,
        cacheWriteTokens: 2,
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
    });
    expect(first.aborted).toBe(false);
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

    streamUsageScale = 2;
    const second = await runHarnessTurn(turnInput());
    // Second turn resumes: the stored resume state is handed back to the engine.
    expect(createSessionCalls[1]?.resumeFrom).toMatchObject({ type: 'resume-session' });
    expect((await readSession()).generation).toBe(1);
    expect(second.tokenUsage).toEqual(first.tokenUsage);
});

test('persists Claude plan limits emitted by the managed SDK turn', async () => {
    streamProviderMetadata = {
        'claude-code': {
            planUsage: {
                rate_limits: {
                    five_hour: {
                        resets_at: '2026-08-14T20:00:00.000Z',
                        utilization: 12,
                    },
                    seven_day: {
                        resets_at: '2026-08-20T20:00:00.000Z',
                        utilization: 34,
                    },
                },
                rate_limits_available: true,
                subscription_type: 'max',
            },
        },
    };

    const result = await runHarnessTurn(turnInput({ runtimeId: 'claude-code' }));

    expect(result.claudePlanUsage).toMatchObject({
        source: 'claude-code-sdk-usage',
        subscriptionType: 'max',
        windows: [
            { id: 'current-session', usedPercent: 12 },
            { id: 'current-week-all-models', usedPercent: 34 },
        ],
    });
    expect((await readClaudePlanUsageState(agentRoot)).snapshot).toEqual(result.claudePlanUsage);
});

test('seeds a Codex cumulative baseline when upgrading an existing session', async () => {
    await runHarnessTurn(turnInput());
    const { cumulativeTokenUsage: _removed, ...legacySession } = await readSession();
    await writeFile(join(agentRoot, 'session.json'), `${JSON.stringify(legacySession)}\n`);
    streamUsageScale = 2;

    const migrated = await runHarnessTurn(turnInput());

    expect(migrated.tokenUsage).toBeNull();
    expect((await readSession()).cumulativeTokenUsage).toEqual({
        cacheReadTokens: 16,
        cacheWriteTokens: 4,
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
    });
});

test('refreshes a pre-fingerprint session once without rotating it', async () => {
    await runHarnessTurn(turnInput());
    const {
        bootstrapFingerprint: _bootstrapFingerprint,
        instructionFingerprint: _instructionFingerprint,
        ...legacySession
    } = await readSession();
    await writeFile(join(agentRoot, 'session.json'), `${JSON.stringify(legacySession)}\n`);

    await runHarnessTurn(turnInput());

    const refreshed = await readSession();
    expect(refreshedBootstraps).toBe(1);
    expect(refreshed.generation).toBe(1);
    expect(refreshed.bootstrapFingerprint).not.toBeNull();
    expect(refreshed.instructionFingerprint).not.toBeNull();
});

test('keeps detailed tool evidence local instead of returning raw tool names', async () => {
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

    expect(result).not.toHaveProperty('toolNames');
    const journal = await readComputerExecutionJournal(agentRoot, 'run_test');
    expect(journal?.tools.map((tool) => tool.toolName)).toEqual(streamToolNames);
});

test('keeps billable token usage when a provider fails after reporting usage', async () => {
    streamFails = true;

    await expect(runHarnessTurn(turnInput())).rejects.toMatchObject({
        name: HarnessTurnFailedError.name,
        tokenUsage: {
            cacheReadTokens: 8,
            cacheWriteTokens: 2,
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
        },
    });
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

test('projects a concrete action attention into the first prompt by action identity', async () => {
    await runHarnessTurn(
        turnInput({
            inbox: [
                {
                    actionAttention: {
                        actionId: 'act_create_agent',
                        chatId: 'cht_origin',
                        createdAgentId: 'agt_created',
                        executedResult: {
                            agentId: 'agt_created',
                            avatarUrl: null,
                            chatId: 'cht_created',
                            computerId: 'cmp_local',
                            description: 'A new teammate',
                            displayName: 'Scout',
                            handle: 'scout',
                            modelId: 'gpt-5',
                            reasoningEffort: 'medium',
                            role: 'member',
                            runtimeId: 'codex',
                        },
                        kind: 'agent:create',
                    },
                    chatId: 'cht_origin',
                    content: '',
                    createdAt: '2026-07-27T00:00:00.000Z',
                    id: 'act_create_agent',
                    senderHandle: 'grotto',
                    senderType: 'system',
                    sequence: 0,
                    target: '#general',
                },
            ],
            inboxDelivery: 'concrete',
        })
    );

    expect(streamedPrompts[0]).toContain('act_create_agent');
    expect(streamedPrompts[0]).toContain('agt_created');
    expect(streamedPrompts[0]).toContain('"handle":"scout"');
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
        sessionId: 'engine_session_1',
    });
    expect(createSessionCalls[2]).toMatchObject({
        sessionId: 'engine_session_1',
    });
    expect(createSessionCalls[2]?.resumeFrom).toMatchObject({
        data: { nativeSessionId: 'native_session_1' },
        type: 'resume-session',
    });
    expect(stoppedSessions).toBe(1);
    expect(refreshedBootstraps).toBe(1);
    expect((await readSession()).generation).toBe(1);
    await expect(access(join(runtimeDir, 'restart-requested'))).rejects.toThrow();

    await runHarnessTurn(turnInput());
    expect(createSessionCalls[3]?.resumeFrom).toMatchObject({ type: 'resume-session' });
    expect(refreshedBootstraps).toBe(1);
});

test('managed instruction drift reaches the next resumed turn once without rotating its session', async () => {
    const first = await runHarnessTurn(turnInput({ initialRole: 'Own the original lane.' }));
    const firstSession = await readSession();
    streamUsageScale = 2;
    const updateActivity: Array<{ category: string; phase: string }> = [];

    const second = await runHarnessTurn(
        turnInput({
            initialRole: 'Own the updated lane.',
            onActivity: (event) => updateActivity.push(event),
        })
    );

    expect(agentInstructions[0]).toContain('Own the original lane.');
    expect(agentInstructions[1]).toContain('Own the updated lane.');
    expect(agentInstructions[1]).not.toBe(agentInstructions[0]);
    expect(createSessionCalls[1]).toEqual({
        resumeFrom: firstSession.resumeState,
        sessionId: 'engine_session_1',
    });
    expect(second.tokenUsage?.cacheReadTokens).toBe(8);
    expect(second.tokenUsage).toEqual(first.tokenUsage);
    expect(stoppedSessions).toBe(0);
    expect(refreshedBootstraps).toBe(0);
    const updatedSession = await readSession();
    expect(updatedSession.generation).toBe(1);
    expect(updatedSession.runtimeSessionId).toBe('engine_session_1');
    expect(updatedSession.instructionFingerprint).not.toBe(firstSession.instructionFingerprint);
    expect(updateActivity).toEqual([
        { category: 'updating_instructions', phase: 'started' },
        { category: 'thinking', phase: 'started' },
        { category: 'thinking', phase: 'completed' },
        { category: 'updating_instructions', phase: 'completed' },
    ]);

    streamUsageScale = 3;
    const settledActivity: Array<{ category: string; phase: string }> = [];
    await runHarnessTurn(
        turnInput({
            initialRole: 'Own the updated lane.',
            onActivity: (event) => settledActivity.push(event),
        })
    );

    expect(createSessionCalls[2]?.resumeFrom).toEqual(updatedSession.resumeState);
    expect((await readSession()).generation).toBe(1);
    expect(settledActivity).toEqual([
        { category: 'thinking', phase: 'started' },
        { category: 'thinking', phase: 'completed' },
    ]);
    expect(stoppedSessions).toBe(0);
    expect(refreshedBootstraps).toBe(0);
});

test('Cove guidance drift migrates a warm session once and is current when the resumed turn streams', async () => {
    const workspaceDir = join(agentRoot, 'workspace');
    await seedCoveWorkspace(workspaceDir);
    await runHarnessTurn(turnInput({ factoryKind: 'cove' }));
    const firstSession = await readSession();
    await writeFile(join(workspaceDir, 'MEMORY.md'), '# Cove\n\nLearned context.\n');
    await writeFile(join(workspaceDir, 'onboarding_objectives.md'), 'owner progress\n');
    await writeFile(join(workspaceDir, 'onboarding_playbook.md'), legacyCovePlaybook);
    await writeFile(join(workspaceDir, 'onboarding_knowledge_faq.md'), legacyCoveFaq);
    const updateActivity: Array<{ category: string; phase: string }> = [];

    await runHarnessTurn(
        turnInput({
            factoryKind: 'cove',
            onActivity: (event) => updateActivity.push(event),
        })
    );

    expect(createSessionCalls[1]).toEqual({
        resumeFrom: firstSession.resumeState,
        sessionId: 'engine_session_1',
    });
    expect((await readSession()).generation).toBe(1);
    expect(await readFile(join(workspaceDir, 'MEMORY.md'), 'utf8')).toContain('Learned context.');
    expect(await readFile(join(workspaceDir, 'onboarding_objectives.md'), 'utf8')).toBe(
        'owner progress\n'
    );
    expect(await readFile(join(workspaceDir, 'onboarding_playbook.md'), 'utf8')).toContain(
        'post an **action card** rather than a copyable spec'
    );
    expect(streamedCovePlaybooks[1]).toContain(
        'post an **action card** rather than a copyable spec'
    );
    expect(streamedCoveFaqs[1]).toContain('prepare a native action card');
    expect(streamedPrompts[1]).toContain('re-read onboarding_playbook.md');
    expect(updateActivity).toEqual([
        { category: 'updating_instructions', phase: 'started' },
        { category: 'thinking', phase: 'started' },
        { category: 'thinking', phase: 'completed' },
        { category: 'updating_instructions', phase: 'completed' },
    ]);
    expect(stoppedSessions).toBe(0);
    expect(refreshedBootstraps).toBe(0);
    await expect(
        access(join(agentRoot, 'runtime', 'cove-guidance-refresh.json'))
    ).rejects.toThrow();

    const settledActivity: Array<{ category: string; phase: string }> = [];
    await runHarnessTurn(
        turnInput({
            factoryKind: 'cove',
            onActivity: (event) => settledActivity.push(event),
        })
    );

    expect(createSessionCalls).toHaveLength(3);
    expect(streamedPrompts[2]).not.toContain('re-read onboarding_playbook.md');
    expect(settledActivity).toEqual([
        { category: 'thinking', phase: 'started' },
        { category: 'thinking', phase: 'completed' },
    ]);
    expect(stoppedSessions).toBe(0);
    expect(refreshedBootstraps).toBe(0);
});

test('preserves edited Cove guidance and records a failed operator-visible refresh', async () => {
    const workspaceDir = join(agentRoot, 'workspace');
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(join(workspaceDir, 'onboarding_playbook.md'), 'owner customization\n');
    const activity: Array<{ category: string; phase: string }> = [];

    await runHarnessTurn(
        turnInput({
            factoryKind: 'cove',
            onActivity: (event) => activity.push(event),
        })
    );

    expect(await readFile(join(workspaceDir, 'onboarding_playbook.md'), 'utf8')).toBe(
        'owner customization\n'
    );
    expect(activity).toContainEqual({ category: 'updating_instructions', phase: 'started' });
    expect(activity).toContainEqual({ category: 'updating_instructions', phase: 'failed' });
    expect(activity).not.toContainEqual({
        category: 'updating_instructions',
        phase: 'completed',
    });
    expect(streamedPrompts[0]).toContain('could not update');
});

test('retries Cove guidance consumption after a refreshed turn fails', async () => {
    const workspaceDir = join(agentRoot, 'workspace');
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(join(workspaceDir, 'onboarding_playbook.md'), legacyCovePlaybook);
    await writeFile(join(workspaceDir, 'onboarding_knowledge_faq.md'), legacyCoveFaq);
    streamFails = true;
    const failedActivity: Array<{ category: string; phase: string }> = [];

    await expect(
        runHarnessTurn(
            turnInput({
                factoryKind: 'cove',
                onActivity: (event) => failedActivity.push(event),
            })
        )
    ).rejects.toBeInstanceOf(HarnessTurnFailedError);

    expect(failedActivity).toContainEqual({
        category: 'updating_instructions',
        phase: 'failed',
    });
    expect(await readFile(join(workspaceDir, 'onboarding_playbook.md'), 'utf8')).toContain(
        'post an **action card** rather than a copyable spec'
    );

    streamFails = false;
    const retryActivity: Array<{ category: string; phase: string }> = [];
    await runHarnessTurn(
        turnInput({
            factoryKind: 'cove',
            onActivity: (event) => retryActivity.push(event),
        })
    );

    expect(streamedPrompts[1]).toContain('re-read onboarding_playbook.md');
    expect(retryActivity).toContainEqual({
        category: 'updating_instructions',
        phase: 'completed',
    });
    await expect(
        access(join(agentRoot, 'runtime', 'cove-guidance-refresh.json'))
    ).rejects.toThrow();
});

test('bootstrap drift parks and refreshes the same native session once with current instructions', async () => {
    await runHarnessTurn(turnInput({ initialRole: 'Own the original lane.' }));
    const firstSession = await readSession();
    await writeFile(
        join(agentRoot, 'session.json'),
        `${JSON.stringify({ ...firstSession, bootstrapFingerprint: 'stale' })}\n`
    );
    const updateActivity: Array<{ category: string; phase: string }> = [];

    await runHarnessTurn(
        turnInput({
            initialRole: 'Own the updated lane.',
            onActivity: (event) => updateActivity.push(event),
        })
    );

    expect(createSessionCalls[1]).toEqual({
        resumeFrom: firstSession.resumeState,
        sessionId: 'engine_session_1',
    });
    expect(createSessionCalls[2]).toEqual({
        resumeFrom: {
            data: { nativeSessionId: 'native_session_1' },
            harnessId: 'fake',
            type: 'resume-session',
        },
        sessionId: 'engine_session_1',
    });
    expect(agentInstructions[1]).toContain('Own the updated lane.');
    expect(stoppedSessions).toBe(1);
    expect(refreshedBootstraps).toBe(1);
    const refreshedSession = await readSession();
    expect(refreshedSession.generation).toBe(1);
    expect(refreshedSession.runtimeSessionId).toBe('engine_session_1');
    expect(refreshedSession.bootstrapFingerprint).not.toBe('stale');
    expect(updateActivity).toEqual([
        { category: 'updating_instructions', phase: 'started' },
        { category: 'thinking', phase: 'started' },
        { category: 'thinking', phase: 'completed' },
        { category: 'updating_instructions', phase: 'completed' },
    ]);

    const settledActivity: Array<{ category: string; phase: string }> = [];
    await runHarnessTurn(
        turnInput({
            initialRole: 'Own the updated lane.',
            onActivity: (event) => settledActivity.push(event),
        })
    );

    expect(createSessionCalls[3]).toEqual({
        resumeFrom: refreshedSession.resumeState,
        sessionId: 'engine_session_1',
    });
    expect(createSessionCalls).toHaveLength(4);
    expect((await readSession()).generation).toBe(1);
    expect(stoppedSessions).toBe(1);
    expect(refreshedBootstraps).toBe(1);
    expect(settledActivity).toEqual([
        { category: 'thinking', phase: 'started' },
        { category: 'thinking', phase: 'completed' },
    ]);
});

test('a failed bootstrap refresh stays stale without rejecting the native session', async () => {
    await runHarnessTurn(turnInput());
    const staleSession = await readSession();
    await writeFile(
        join(agentRoot, 'session.json'),
        `${JSON.stringify({ ...staleSession, bootstrapFingerprint: 'stale' })}\n`
    );
    restoreBootstrapRefresh();
    restoreBootstrapRefresh = setHarnessBootstrapRefreshForTesting(async () => {
        throw new Error('bootstrap rejected');
    });
    const activity: Array<{ category: string; phase: string }> = [];

    const failure = await runHarnessTurn(
        turnInput({ onActivity: (event) => activity.push(event) })
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(AgentSessionResumeRejectedError);
    expect((await readSession()).bootstrapFingerprint).toBe('stale');
    expect(activity).toEqual([
        { category: 'updating_instructions', phase: 'started' },
        { category: 'updating_instructions', phase: 'failed' },
    ]);
});

test('a stream failure records a failed instruction refresh and leaves its receipt stale', async () => {
    await runHarnessTurn(turnInput());
    const staleSession = await readSession();
    await writeFile(
        join(agentRoot, 'session.json'),
        `${JSON.stringify({ ...staleSession, instructionFingerprint: 'stale' })}\n`
    );
    streamFails = true;
    const activity: Array<{ category: string; phase: string }> = [];

    await expect(
        runHarnessTurn(turnInput({ onActivity: (event) => activity.push(event) }))
    ).rejects.toBeInstanceOf(HarnessTurnFailedError);

    expect((await readSession()).instructionFingerprint).toBe('stale');
    expect(activity).toContainEqual({ category: 'updating_instructions', phase: 'started' });
    expect(activity).toContainEqual({ category: 'updating_instructions', phase: 'failed' });
    expect(activity).not.toContainEqual({
        category: 'updating_instructions',
        phase: 'completed',
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
            receipt: { runId: 'run_active', workIds: ['msg_late'] },
        })
    );
    const receipts: Array<{ runId: string; workIds: string[] }> = [];

    await runHarnessTurn(
        turnInput({
            inbox: [],
            onStoredNoticeDelivered: (receipt) => receipts.push(receipt),
            totalPending: 0,
        })
    );

    expect(sentUserMessages).toEqual([notice]);
    expect(receipts).toEqual([{ runId: 'run_active', workIds: ['msg_late'] }]);
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
            receipt: { runId: 'run_active', workIds: ['msg_late'] },
        })
    );
    const receipts: Array<{ runId: string; workIds: string[] }> = [];

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
