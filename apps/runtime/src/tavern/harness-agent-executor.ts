import path from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import {
    HarnessAgent,
    type HarnessAgentResumeSessionState,
    type HarnessAgentSession,
    type HarnessAgentSkill,
} from '@ai-sdk/harness/agent';
import { type ClaudeCodeAuthOptions, createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createCodex } from '@ai-sdk/harness-codex';
import { createPi, type PiAuthOptions } from '@ai-sdk/harness-pi';
import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeModelName, AgentRuntimeThinkingLevel } from '@tavern/api';
import { buildAgentToolEnvironment } from '../agent-engine/agent-cli-wrapper.ts';
import { createBrowserToolForAgent } from '../agent-engine/host-tools.ts';
import { createLocalTrustedSandboxProvider } from '../agent-engine/local-trusted-sandbox.ts';
import { createAgentMcpTools } from '../agent-engine/mcp-clients.ts';
import {
    type AssignedSkillBundle,
    readAssignedSkillBundles,
} from '../agent-engine/skill-library.ts';
import { readConfigValue } from '../config.ts';
import { log } from '../log.ts';
import {
    ensureFreshClaudeCredentials,
    getClaudeHarnessAuth,
} from '../model-access/claude-settings.ts';
import { ensureFreshKimiCredentials, getKimiHarnessAuth } from '../model-access/kimi-settings.ts';
import { readAnthropicApiKey } from '../models/provider-registry.ts';
import { kimiCodingBaseUrl, kimiCodingModelDefinitions } from '../models/provider-sources/kimi.ts';
import { recordInjectedSkillUsage } from '../skills/telemetry.ts';
import { createWebToolsForAgent } from '../web/agent-tools.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructionBundle } from './agent-instructions.ts';
import {
    recordAgentSessionInstructionsHash,
    updateAgentSessionRuntimeState,
} from './agent-session-store.ts';
import { recordAgentTurnPromptEvidence } from './agent-turn-store.ts';
import { withRuntimeBridgeBootstrap } from './harness-bridge-bootstrap.ts';
import { observeHarnessTurnStream } from './harness-stream-observer.ts';

interface ActiveHarnessTurn {
    controller: AbortController;
    session?: HarnessAgentSession;
}

export function createHarnessAgentExecutor(): AgentExecutor {
    const active = new Map<string, ActiveHarnessTurn>();

    return {
        async deliverUserMessage(runId, text) {
            const session = active.get(runId)?.session;
            if (!session) {
                return false;
            }
            try {
                return await session.sendUserMessage(text);
            } catch {
                return false;
            }
        },
        async execute(input) {
            const controller = new AbortController();
            const activeTurn: ActiveHarnessTurn = { controller };
            active.set(input.runId, activeTurn);
            try {
                return await executeHarnessTurn(input, controller.signal, activeTurn);
            } finally {
                active.delete(input.runId);
            }
        },
        async stop(runId) {
            const turn = active.get(runId);
            if (!turn) {
                return false;
            }
            turn.controller.abort();
            await turn.session?.destroy().catch(() => {});
            return true;
        },
    };
}

async function executeHarnessTurn(
    input: AgentExecutorInput,
    abortSignal: AbortSignal,
    activeTurn: ActiveHarnessTurn
) {
    const startedAt = new Date().toISOString();

    // Sign-in tokens refresh before the turn so the harness always receives
    // a live credential (specs/model-access.md).
    if (input.agentSession.effectiveModel.provider === 'claude') {
        await ensureFreshClaudeCredentials();
    }
    if (input.agentSession.effectiveModel.provider === 'kimi') {
        await ensureFreshKimiCredentials();
    }

    const { fingerprint, instructions } = await buildAgentInstructionBundle(input);
    // Harness adapters frame instructions into a session's first prompt and
    // drop them on resumed turns, so only non-resume turns deliver them.
    const instructionsDelivered = !input.agentSession.resumeState;
    const skills = await readHarnessAgentSkills(input);
    try {
        recordAgentTurnPromptEvidence({
            evidence: {
                capturedAt: startedAt,
                instructions,
                instructionsDelivered,
                prompt: input.prompt,
            },
            id: input.runId,
        });
    } catch (error) {
        log.warn('Turn prompt evidence was not recorded', { err: error, runId: input.runId });
    }
    if (instructionsDelivered) {
        recordAgentSessionInstructionsHash({ hash: fingerprint, id: input.agentSession.id });
    }
    const agent = await harnessAgentFactory(input, createLocalTrustedSandboxProvider, {
        instructions,
        skills,
    });
    let session: HarnessAgentSession | undefined;
    try {
        const sessionId = input.agentSession.runtimeSessionId ?? input.agentSession.id;
        const resumeFrom = input.agentSession.resumeState as
            | HarnessAgentResumeSessionState
            | undefined;
        try {
            session = await agent.createSession({ abortSignal, resumeFrom, sessionId });
        } catch (error) {
            if (!resumeFrom) {
                throw error;
            }
            // A stored session can predate sandbox or work-directory changes;
            // continuing fresh beats failing the turn.
            log.warn('Agent session resume failed; starting a fresh session', {
                err: error,
                runId: input.runId,
            });
            session = await agent.createSession({ abortSignal, sessionId });
        }
        activeTurn.session = session;

        const turn = await agent.stream({
            abortSignal,
            prompt: input.prompt,
            session,
        });
        const observation = await observeHarnessTurnStream(
            { agentId: input.agent.id },
            turn.fullStream
        );
        const resumeState = await session.stop();
        activeTurn.session = undefined;
        updateAgentSessionRuntimeState({
            id: input.agentSession.id,
            resumeState: resumeState as Record<string, unknown>,
            runtimeSessionId: session.sessionId,
        });
        return { contextTokens: observation.contextTokens };
    } catch (error) {
        activeTurn.session = undefined;
        await session?.destroy().catch(() => {});
        throw formatHarnessExecutionError(input, error);
    }
}

let harnessAgentFactory: typeof createHarnessAgent = createHarnessAgent;

export function setHarnessAgentFactoryForTesting(factory: typeof createHarnessAgent) {
    const previous = harnessAgentFactory;
    harnessAgentFactory = factory;
    return () => {
        harnessAgentFactory = previous;
    };
}

async function createHarnessAgent(
    input: AgentExecutorInput,
    sandboxFactory: typeof createLocalTrustedSandboxProvider,
    options: {
        instructions: string;
        skills: HarnessAgentSkill[];
    }
) {
    const harness = createHarness(input);
    // Host tools and exact MCP grants compose into the AI SDK turn surface.
    const tools = {
        ...createWebToolsForAgent(input.agent),
        ...createBrowserToolForAgent(input.agent.id),
        ...(await createAgentMcpTools({
            agentId: input.agent.id,
            turnId: input.runId,
        })),
    };
    return new HarnessAgent({
        harness,
        id: input.agent.id,
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: sandboxFactory(localTrustedSandboxOptions(input)),
        // Sessions work at the workspace root itself: the sandbox anchors at
        // the workspace's parent and workDir names the workspace folder, so
        // the composed session work directory IS the workspace. The harness
        // default (an invisible per-session directory) hides agent files from
        // workspace browsing and the artifact panel.
        sandboxConfig: { workDir: path.basename(input.agent.workspaceFolder) },
        skills: options.skills,
        tools,
    });
}

export async function readHarnessAgentSkills(
    input: AgentExecutorInput,
    options: { skillsDir?: string } = {}
): Promise<HarnessAgentSkill[]> {
    const skills = await readAssignedSkillBundles(input.agent, options);
    recordInjectedSkillUsage({
        agentId: input.agent.id,
        skillIds: skills.filter((skill) => skill.path !== null).map((skill) => skill.id),
    });
    return skills.map(toHarnessAgentSkill);
}

function toHarnessAgentSkill(skill: AssignedSkillBundle): HarnessAgentSkill {
    return {
        content: skill.content,
        description: skill.description,
        ...(skill.files.length > 0 ? { files: skill.files } : {}),
        name: skill.id,
    };
}

// Anchored one level above the workspace so the session work directory
// (rootDir + sandboxConfig.workDir) resolves to the workspace root itself.
function localTrustedSandboxOptions(input: AgentExecutorInput) {
    const rootDir = path.dirname(input.agent.workspaceFolder);
    const agentCli = buildAgentToolEnvironment(input.agent.id);
    if (input.agentSession.effectiveModel.provider !== 'codex') {
        return { env: agentCli.env, rootDir };
    }
    const homeDir = path.join(input.agent.workspaceFolder, '.home');
    return {
        authProfiles: ['codex'] as const,
        env: {
            ...agentCli.env,
            CODEX_HOME: path.join(homeDir, '.codex'),
            HOME: homeDir,
        },
        homeDir,
        rootDir,
    };
}

function createHarness(input: AgentExecutorInput): HarnessV1<ToolSet> {
    return createHarnessForModel({
        modelName: input.agentSession.effectiveModel,
        thinkingDefault: input.agent.thinkingDefault,
        webSearch: input.agent.webAccessEnabled === true,
    });
}

export function createHarnessForModel(input: {
    modelName: AgentRuntimeModelName;
    thinkingDefault?: AgentRuntimeThinkingLevel | null;
    webSearch?: boolean;
}): HarnessV1<ToolSet> {
    const modelName = input.modelName;
    switch (modelName.provider) {
        // Both run the Claude Code harness; they differ only in credential —
        // claude carries the sign-in token, anthropic a plain API key.
        case 'anthropic':
        case 'claude':
            return createClaudeCodeHarnessForRuntime({
                auth: claudeCodeAuthOptions(modelName.provider),
                // Native WebFetch stays disallowed even with web access on:
                // web_fetch is the uniform Tavern fetch tool across providers,
                // so page reads keep one size-cap and injection posture.
                disallowedTools: input.webSearch ? ['WebFetch'] : ['WebSearch', 'WebFetch'],
                // CLI-only output (D1) makes every send/check/read a tool
                // call, so turns legitimately run long tool loops; the turn
                // watchdog is the real bound, this only stops runaways.
                maxTurns: 50,
                model: modelName.model,
                thinking: claudeThinking(input.thinkingDefault),
            }) as HarnessV1<ToolSet>;
        case 'codex':
            return createCodexHarnessForRuntime({
                model: modelName.model,
                reasoningEffort: codexReasoningEffort(input.thinkingDefault),
                ...(input.webSearch ? { webSearch: true } : {}),
            }) as HarnessV1<ToolSet>;
        case 'kimi':
        case 'openai':
        case 'openai-compatible': {
            const auth = piAuthOptions(modelName.provider);
            const thinkingLevel =
                modelName.provider === 'kimi'
                    ? kimiThinkingLevel(modelName, input.thinkingDefault)
                    : piThinkingLevel(input.thinkingDefault);
            return createPi({
                ...(auth ? { auth } : {}),
                model: piModelId(modelName),
                ...(thinkingLevel ? { thinkingLevel } : {}),
            }) as HarnessV1<ToolSet>;
        }
        default:
            throw new Error(`Unsupported harness model provider "${modelName.provider}".`);
    }
}

export function createClaudeCodeHarnessForRuntime(
    settings: Parameters<typeof createClaudeCode>[0] = {}
) {
    return withRuntimeBridgeBootstrap(createClaudeCode(settings), 'claude-code');
}

export function createCodexHarnessForRuntime(settings: Parameters<typeof createCodex>[0] = {}) {
    return withRuntimeBridgeBootstrap(createCodex(settings), 'codex');
}

export function claudeCodeAuthOptions(
    provider: 'anthropic' | 'claude' = 'claude'
): ClaudeCodeAuthOptions | undefined {
    const baseUrl =
        readConfigValue('TAVERN_AGENT_CLAUDE_CODE_BASE_URL') ??
        readConfigValue('ANTHROPIC_BASE_URL');
    if (provider === 'anthropic') {
        const apiKey = readAnthropicApiKey();
        if (!(apiKey || baseUrl)) {
            return undefined;
        }
        return {
            anthropic: {
                ...(apiKey ? { apiKey } : {}),
                ...(baseUrl ? { baseUrl } : {}),
            },
        };
    }
    // Runtime-owned credentials (Model access) win: they survive upgrades
    // and headless hosts, unlike engine-side keychain auth. Env overrides
    // remain the operator escape hatch.
    const stored = getClaudeHarnessAuth();
    if (stored) {
        return { anthropic: { ...stored, ...(baseUrl ? { baseUrl } : {}) } };
    }
    const authToken =
        readConfigValue('TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN') ??
        readConfigValue('ANTHROPIC_AUTH_TOKEN');
    if (!(authToken || baseUrl)) {
        return undefined;
    }
    return {
        anthropic: {
            ...(authToken ? { authToken } : {}),
            ...(baseUrl ? { baseUrl } : {}),
        },
    };
}

export function piAuthOptions(
    provider: AgentRuntimeModelName['provider']
): PiAuthOptions | undefined {
    if (provider === 'openai') {
        const apiKey = readConfigValue('TAVERN_AGENT_API_KEY') ?? readConfigValue('OPENAI_API_KEY');
        return apiKey ? { customEnv: { OPENAI_API_KEY: apiKey } } : undefined;
    }
    if (provider === 'openai-compatible') {
        const baseUrl = readConfigValue('TAVERN_AGENT_BASE_URL');
        if (!baseUrl) {
            return undefined;
        }
        return {
            customEnv: {
                OPENAI_API_KEY: readConfigValue('TAVERN_AGENT_API_KEY') ?? 'tavern-local',
                OPENAI_BASE_URL: baseUrl,
            },
        };
    }
    if (provider === 'kimi') {
        // The subscription OAuth access token is the bearer; the customEnv
        // prefix registers pi's kimi-coding provider, and the model
        // definitions ride along because our pinned pi registry predates
        // K3 (KIMI_CODING_MODELS_JSON is a Tavern patch extension).
        const auth = getKimiHarnessAuth();
        if (!auth) {
            return undefined;
        }
        return {
            customEnv: {
                KIMI_CODING_API_KEY: auth.accessToken,
                KIMI_CODING_BASE_URL: kimiCodingBaseUrl,
                KIMI_CODING_MODELS_JSON: JSON.stringify(kimiCodingModelDefinitions),
            },
        };
    }
    return undefined;
}

// Pi rejects bare model ids that exist under several providers (gpt-4.1-mini
// also ships as azure-openai-responses), so OpenAI and Kimi routes use the
// canonical provider/model reference (kimi's pi provider id is kimi-coding).
function piModelId(model: AgentRuntimeModelName) {
    if (model.provider === 'openai') {
        return `openai/${model.model}`;
    }
    if (model.provider === 'kimi') {
        return `kimi-coding/${model.model}`;
    }
    return model.model;
}

export function formatHarnessExecutionError(input: AgentExecutorInput, error: unknown): Error {
    const message = errorMessage(error);
    if (
        input.agentSession.effectiveModel.provider === 'claude' &&
        /401|authenticat|credential/iu.test(message)
    ) {
        return new Error(
            [
                'Claude is not connected.',
                'Connect Claude in Settings → Connections → Model access.',
                `Original error: ${message}`,
            ].join(' ')
        );
    }
    if (
        input.agentSession.effectiveModel.provider === 'anthropic' &&
        /401|authenticat|credential|api key/iu.test(message)
    ) {
        return new Error(
            [
                'The Anthropic API key is missing or invalid.',
                'Update it in Settings → Connections → Model access.',
                `Original error: ${message}`,
            ].join(' ')
        );
    }
    if (
        input.agentSession.effectiveModel.provider === 'kimi' &&
        /401|403|authenticat|credential/iu.test(message)
    ) {
        return new Error(
            [
                'Kimi Code is not connected.',
                'Connect Kimi in Settings → Connections → Model access.',
                `Original error: ${message}`,
            ].join(' ')
        );
    }
    if (
        (input.agentSession.effectiveModel.provider === 'openai' ||
            input.agentSession.effectiveModel.provider === 'openai-compatible') &&
        /401|authenticat|credential|api key/iu.test(message)
    ) {
        return new Error(
            [
                'Pi failed to authenticate for Grotto agent execution.',
                'Verify AI Gateway, OPENAI_API_KEY, or TAVERN_AGENT_API_KEY/TAVERN_AGENT_BASE_URL is configured for the selected model.',
                `Original error: ${message}`,
            ].join(' ')
        );
    }
    if (error instanceof Error) {
        return error;
    }
    return new Error(message);
}

function claudeThinking(value: AgentRuntimeThinkingLevel | null | undefined) {
    if (value === 'off') {
        return 'off';
    }
    if (value === 'adaptive') {
        return 'adaptive';
    }
    return value ? 'on' : undefined;
}

function codexReasoningEffort(value: AgentRuntimeThinkingLevel | null | undefined) {
    if (value === 'low' || value === 'minimal') {
        return 'low';
    }
    if (value === 'medium') {
        return 'medium';
    }
    if (value && value !== 'off') {
        return 'high';
    }
    return undefined;
}

/**
 * K3's thinking is binary — upstream pi exposes only its `max` level
 * (earendil-works/pi#6737) — so any requested thinking level engages it
 * (as pi `xhigh`, which the K3 definition maps to Kimi `max`) and `off`
 * stays off. Intermediate efforts would otherwise leak to an endpoint that
 * does not support them. Other Kimi models keep the generic ladder,
 * matching upstream pi behavior.
 */
export function kimiThinkingLevel(
    model: AgentRuntimeModelName,
    value: AgentRuntimeThinkingLevel | null | undefined
) {
    const level = piThinkingLevel(value);
    if (model.model !== 'k3' || !level || level === 'off') {
        return level;
    }
    return 'xhigh';
}

function piThinkingLevel(value: AgentRuntimeThinkingLevel | null | undefined) {
    if (
        value === 'off' ||
        value === 'minimal' ||
        value === 'low' ||
        value === 'medium' ||
        value === 'high' ||
        value === 'xhigh'
    ) {
        return value;
    }
    // Pi's thinking scale tops out at xhigh; models whose top tier is named
    // differently map it per-model via thinkingLevelMap (kimi k3: xhigh→max).
    if (value === 'max') {
        return 'xhigh';
    }
    return undefined;
}

function errorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error);
}
