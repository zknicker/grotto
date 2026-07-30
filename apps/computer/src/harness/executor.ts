import { readFile, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import {
    HarnessAgent,
    type HarnessAgentResumeSessionState,
    type HarnessAgentSession,
    type HarnessAgentSkill,
} from '@ai-sdk/harness/agent';
import { createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createCodex } from '@ai-sdk/harness-codex';
import { createPi } from '@ai-sdk/harness-pi';
import type { ToolSet } from '@ai-sdk/provider-utils';
import { composeInboxDrain } from '../inbox-format.ts';
import type { HostedAgentInboxItem } from '../launch.ts';
import { withComputerBridgeBootstrap } from './bridge-bootstrap.ts';
import { composeAgentInstructions } from './instructions.ts';
import { projectHostedMessageForAgent } from './rich-reference-projection.ts';
import { createLocalTrustedSandboxProvider } from './sandbox.ts';
import {
    type AgentSessionState,
    readAgentSessionState,
    resolveTurnSession,
    writeAgentSessionState,
} from './session-store.ts';
import { readAgentSkills } from './skills.ts';

/**
 * A ported copy of Runtime's `harness-agent-executor.ts`, adapted to the
 * Computer's launch boundary. It drives the real `@ai-sdk/harness` Codex, Claude
 * Code, and Pi adapters for one Agent turn: an isolated workspace/HOME/skills,
 * native host provider login (the sandbox seeds the machine's own session), the
 * managed `grotto` wrapper as the sole output channel, the ported Grotto
 * operating/system prompt (`instructions.ts`) composed per turn and delivered
 * once on cold start, and the Agent's one global persistent session resumed
 * across turns. Runtime-owned boundaries not available here — credential
 * injection (native host login replaces it), telemetry, and composition
 * publishing — are dropped or replaced.
 */
export interface HarnessTurnInput {
    agentId: string;
    /** The Agent handle: `@agentName` and the identity/mention sections. */
    agentName: string;
    /** The Agent's local partition root: `<serverId>/agents/<agentId>`. */
    agentRoot: string;
    /** Sandbox env: `grotto` on PATH, proxy/MCP identity, HOME. */
    env: Record<string, string>;
    homeDir: string;
    /** Home timezone for the Current Runtime Context section. */
    homeTimezone: string;
    /** Structured Server-owned inbox rows. Computer owns their model projection. */
    inbox: HostedAgentInboxItem[];
    /** The Agent's description — the personality surface (ruling W2). */
    initialRole: string | null;
    modelId: string;
    registerNoticeSink?: NoticeSinkRegistrar;
    runtimeId: string;
    sessionGeneration: number;
    signal?: AbortSignal;
    skillsDir: string;
    /** Runtime's grant-filtered MCP tools, now composed by Computer. */
    tools: ToolSet;
    /** Resolved web-access variant, or null when off. */
    webAccess: 'fetch-only' | 'search' | 'search-only' | null;
    workspaceDir: string;
}

export type NoticeSinkRegistrar = (sink: (notice: string) => Promise<boolean>) => () => void;

export interface HarnessTurnResult {
    contextTokens: number | null;
    toolNames: string[];
}

/** Resume was rejected; the caller rotates the generation and cold-starts once. */
export class AgentSessionResumeRejectedError extends Error {
    constructor(
        readonly agentId: string,
        options?: { cause?: unknown }
    ) {
        super(`Agent ${agentId} could not resume its stored runtime session.`, options);
        this.name = 'AgentSessionResumeRejectedError';
    }
}

export async function runHarnessTurn(input: HarnessTurnInput): Promise<HarnessTurnResult> {
    const stored = await readAgentSessionState(input.agentRoot);
    const session = resolveTurnSession(stored, {
        generation: input.sessionGeneration,
        modelId: input.modelId,
        runtimeId: input.runtimeId,
    });
    // A rotated generation (fresh Agent or a runtime/model change) drops resume
    // state and cold-starts; matching Runtime, instructions only ride a cold
    // start — the adapter persists them in the runtime's own first message.
    return await executeHarnessTurn(input, session);
}

async function executeHarnessTurn(
    input: HarnessTurnInput,
    session: AgentSessionState
): Promise<HarnessTurnResult> {
    const skills = await readAgentSkills(input.skillsDir);
    // The Computer composes the managed Grotto operating contract itself; the
    // harness adapter delivers it once, on the first message of a fresh (cold)
    // session, and never re-applies it on resume (no-redelivery preserved).
    const { instructions } = composeAgentInstructions({
        agentId: input.agentId,
        agentName: input.agentName,
        homeTimezone: input.homeTimezone,
        initialRole: input.initialRole,
        modelId: input.modelId,
        webAccess: input.webAccess,
        workspacePath: input.workspaceDir,
    });
    const agent = harnessAgentFactory(input, { instructions, skills });
    let live: HarnessAgentSession | undefined;
    try {
        const sessionId = session.runtimeSessionId ?? `${input.agentId}-${session.generation}`;
        const resumeFrom =
            (session.resumeState as HarnessAgentResumeSessionState | null) ?? undefined;
        // Unlike Runtime's DB-issued session ids, Computer derives its cold id
        // from the durable generation. A failed/interrupted cold start can leave
        // an unresumable harness run directory behind; remove only that exact
        // cold directory so the next attempt installs the current bridge and
        // starts clean. Successful sessions persist resume state and skip this.
        if (!(resumeFrom || session.runtimeSessionId)) {
            await rm(join(input.agentRoot, '.agent-runs', sessionId), {
                force: true,
                recursive: true,
            });
        }
        try {
            live = await agent.createSession({
                abortSignal: input.signal,
                resumeFrom,
                sessionId,
            });
        } catch (error) {
            if (!resumeFrom) {
                throw error;
            }
            throw new AgentSessionResumeRejectedError(input.agentId, { cause: error });
        }

        if (!live.isResume) {
            await runTurn(
                agent,
                live,
                projectHostedMessageForAgent({
                    content:
                        session.generation === 1
                            ? 'Start.'
                            : 'Start.\nFresh session: your previous conversation context is gone. Your workspace and MEMORY.md are intact — MEMORY.md is your recovery point.',
                    enabledSkillIds: skills.map((skill) => skill.name),
                }),
                input.signal
            );
        }
        const turn = await agent.stream({
            abortSignal: input.signal,
            prompt: projectHostedMessageForAgent({
                content: composeInboxDrain(input.inbox, input.homeTimezone),
                enabledSkillIds: skills.map((skill) => skill.name),
            }),
            session: live,
        });
        const deliverNotice = createNoticeDelivery(live, input.agentRoot);
        const unregisterNoticeSink = input.registerNoticeSink?.(deliverNotice);
        let observation: HarnessTurnResult;
        try {
            await deliverStoredNotice(input.agentRoot, deliverNotice);
            observation = await observeTurnStream(turn.fullStream);
        } finally {
            unregisterNoticeSink?.();
        }
        // Detach parks the Harness session while leaving its underlying runtime
        // process alive. The next delivery reattaches to this same per-Agent
        // daemon instead of cold-spawning a new runtime.
        const resumeState = await live.detach();
        await writeAgentSessionState(input.agentRoot, {
            effectiveModel: { modelId: input.modelId, runtimeId: input.runtimeId },
            generation: session.generation,
            resumeState: resumeState as Record<string, unknown>,
            runtimeSessionId: live.sessionId,
        });
        return observation;
    } catch (error) {
        await live?.destroy().catch(() => undefined);
        throw error;
    }
}

function createNoticeDelivery(session: HarnessAgentSession, agentRoot: string) {
    let lastDelivered: string | null = null;
    return async (notice: string) => {
        if (!notice.trim()) {
            return false;
        }
        const accepted = notice === lastDelivered || (await session.sendUserMessage(notice));
        if (accepted) {
            lastDelivered = notice;
            await rm(pendingNoticePath(agentRoot), { force: true });
        }
        return accepted;
    };
}

async function deliverStoredNotice(
    agentRoot: string,
    deliver: (notice: string) => Promise<boolean>
) {
    try {
        const value = JSON.parse(await readFile(pendingNoticePath(agentRoot), 'utf8')) as {
            notice?: unknown;
        };
        if (typeof value.notice === 'string') {
            await deliver(value.notice);
        }
    } catch (cause) {
        if (!(isRecord(cause) && cause.code === 'ENOENT')) {
            throw cause;
        }
    }
}

async function runTurn(
    agent: Pick<HarnessAgent, 'stream'>,
    session: HarnessAgentSession,
    prompt: string,
    signal?: AbortSignal
): Promise<void> {
    const turn = await agent.stream({ abortSignal: signal, prompt, session });
    await observeTurnStream(turn.fullStream);
}

function pendingNoticePath(agentRoot: string) {
    return join(agentRoot, 'runtime', 'pending-notice.json');
}

/**
 * Watches the turn's stream for its context-size fact and terminal state. With
 * CLI-only output the stream is execution evidence, not chat content — the
 * durable reply left through `grotto message send`. A simplified port of
 * Runtime's `harness-stream-observer.ts` with the composition wiring dropped.
 */
async function observeTurnStream(stream: AsyncIterable<unknown>): Promise<HarnessTurnResult> {
    let contextTokens: number | null = null;
    let streamError: unknown;
    let aborted = false;
    const toolNames = new Set<string>();
    for await (const part of stream) {
        if (!isRecord(part) || typeof part.type !== 'string') {
            continue;
        }
        switch (part.type) {
            case 'tool-call':
                if (typeof part.toolName === 'string' && toolNames.size < 6) {
                    toolNames.add(part.toolName.slice(0, 128));
                }
                break;
            case 'finish-step':
                contextTokens = usageContextTokens(part.usage) ?? contextTokens;
                break;
            case 'finish':
                contextTokens ??= usageContextTokens(part.totalUsage);
                break;
            case 'error':
                streamError ??=
                    (part as { error?: unknown }).error ?? new Error('Harness stream failed.');
                break;
            case 'abort':
                aborted = true;
                break;
            default:
                break;
        }
    }
    if (streamError && !aborted) {
        throw streamError instanceof Error ? streamError : new Error(String(streamError));
    }
    return { contextTokens, toolNames: [...toolNames] };
}

// The construction seam. Tests inject a fake harness Agent to exercise the
// executor and CLI-reply path without a real model.
export type HarnessAgentFactory = (
    input: HarnessTurnInput,
    options: { instructions: string; skills: HarnessAgentSkill[] }
) => Pick<HarnessAgent, 'createSession' | 'stream'>;

let harnessAgentFactory: HarnessAgentFactory = createHarnessAgent;

export function setHarnessAgentFactoryForTesting(factory: HarnessAgentFactory) {
    const previous = harnessAgentFactory;
    harnessAgentFactory = factory;
    return () => {
        harnessAgentFactory = previous;
    };
}

function createHarnessAgent(
    input: HarnessTurnInput,
    options: { instructions: string; skills: HarnessAgentSkill[] }
): HarnessAgent {
    return new HarnessAgent({
        harness: createHarnessForRuntime(input.runtimeId, input.modelId, input.webAccess !== null),
        id: input.agentId,
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: createLocalTrustedSandboxProvider(sandboxOptions(input)),
        // The session's work directory IS the workspace: the sandbox anchors at
        // the workspace parent and workDir names the workspace folder, so Agent
        // files stay visible to workspace browsing (Runtime parity).
        sandboxConfig: { workDir: basename(input.workspaceDir) },
        skills: options.skills,
        tools: input.tools,
    });
}

function sandboxOptions(input: HarnessTurnInput) {
    const rootDir = dirname(input.workspaceDir);
    const profile = authProfileFor(input.runtimeId);
    if (input.runtimeId !== 'codex') {
        return {
            ...(profile ? { authProfiles: [profile] as const } : {}),
            env: { ...input.env, HOME: input.homeDir },
            homeDir: input.homeDir,
            rootDir,
        };
    }
    // Codex reads auth + sessions from CODEX_HOME; keep it inside the isolated
    // HOME so the host's native login is reused without leaking cross-Agent.
    return {
        authProfiles: ['codex'] as const,
        env: {
            ...input.env,
            CODEX_HOME: join(input.homeDir, '.codex'),
            HOME: input.homeDir,
        },
        homeDir: input.homeDir,
        rootDir,
    };
}

function authProfileFor(runtimeId: string) {
    if (runtimeId === 'claude-code' || runtimeId === 'codex' || runtimeId === 'pi') {
        return runtimeId;
    }
    return null;
}

/**
 * Selects and configures the `@ai-sdk/harness` adapter by the Computer's own
 * runtime inventory ids, so what inventory advertises and what the Computer runs
 * never diverge. Provider authentication is the host's native login (seeded into
 * the sandbox HOME), so no credential is injected here.
 */
function createHarnessForRuntime(
    runtimeId: string,
    modelId: string,
    webAccess = false
): HarnessV1<ToolSet> {
    switch (runtimeId) {
        case 'claude-code':
            return withComputerBridgeBootstrap(
                createClaudeCode({
                    // web_fetch/web_search are not exposed as engine tools (D5), so
                    // the native browsing tools stay off.
                    disallowedTools: webAccess ? ['WebFetch'] : ['WebSearch', 'WebFetch'],
                    // CLI-only output makes every send/check a tool call, so turns
                    // legitimately run long tool loops.
                    maxTurns: 50,
                    model: modelId,
                }),
                'claude-code'
            ) as HarnessV1<ToolSet>;
        case 'codex':
            return withComputerBridgeBootstrap(
                createCodex({
                    model: modelId,
                    ...(webAccess ? { webSearch: true } : {}),
                }),
                'codex'
            ) as HarnessV1<ToolSet>;
        case 'pi':
            return createPi({ model: modelId }) as HarnessV1<ToolSet>;
        default:
            throw new Error(`Unsupported runtime "${runtimeId}".`);
    }
}

function usageContextTokens(usage: unknown): number | null {
    if (!isRecord(usage)) {
        return null;
    }
    const inputTotal = tokenTotal(usage.inputTokens);
    const outputTotal = tokenTotal(usage.outputTokens);
    if (inputTotal === null && outputTotal === null) {
        return null;
    }
    return (inputTotal ?? 0) + (outputTotal ?? 0);
}

function tokenTotal(group: unknown): number | null {
    if (!isRecord(group)) {
        return null;
    }
    return typeof group.total === 'number' && Number.isFinite(group.total) ? group.total : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
