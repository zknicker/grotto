import { createHash } from 'node:crypto';
import { mkdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    seedAgentWorkspace,
    seedCoveWorkspace,
    seedFactoryManagedSkills,
} from '@grotto/agent-workspace';
import type { ComputerAgentActivityUpdate } from './agent-activity.ts';
import { readAgentSeedConfiguration } from './agent-configuration.ts';
import { acquireAgentLaunchHost } from './agent-launch-host.ts';
import { computerEntrypoint } from './build-identity.ts';
import type { StoredNoticeReceipt } from './delivery.ts';
import {
    AgentSessionResumeRejectedError,
    HarnessTurnFailedError,
    type NoticeSinkRegistrar,
    runHarnessTurn,
} from './harness/executor.ts';
import { composeInboxDrain } from './inbox-format.ts';
import { readRunVisibleMessages } from './inbox-store.ts';
import { resolveRuntimeExecutable, runtimeSearchPath } from './runtime-discovery.ts';
import { classifyRuntimeFailure, type RuntimeFailureKind } from './runtime-failure.ts';
import { createServerMcpTools } from './server-mcp-tools.ts';
import { writeGrottoWrapper } from './wrapper.ts';

export interface Attachment {
    computerId: string;
    credential: string;
    serverId: string;
    serverOrigin: string;
    slug: string;
}

/**
 * The Server→Computer launch command. The Computer owns its own copy of the
 * wire shapes (like `inventory.ts`) rather than importing the Server contract
 * package, keeping the Computer artifact self-contained.
 */
export interface AgentStartCommand {
    /** Server-owned Agent facts the Computer composes into the system prompt. */
    agentDescription?: string;
    agentId: string;
    agentName?: string;
    chatId: string;
    homeTimezone?: string;
    inbox?: AgentInboxItem[];
    inboxDelivery: 'concrete' | 'notice';
    modelId: string;
    runId: string;
    runtimeId: string;
    sessionGeneration: number;
    totalPending: number;
    type: 'start';
    webAccess?: 'fetch-only' | 'search' | 'search-only';
}

export interface AgentInboxItem {
    chatId: string;
    content: string;
    createdAt: string;
    id: string;
    mentioned?: boolean;
    message?: Record<string, unknown>;
    senderDescription?: string;
    senderHandle: string;
    senderType: 'agent' | 'human' | 'system';
    sequence: number;
    target: string;
    task?: {
        assigneeAgentId: string | null;
        assigneeUserId: string | null;
        messageId: string;
        number: number;
        priority: 'high' | 'low' | 'medium' | 'none' | 'urgent';
        status: 'closed' | 'done' | 'in_progress' | 'in_review' | 'todo';
    };
    threadFollowReactivated?: boolean;
}

/** Server→Computer command to terminate the named in-flight run. */
export interface AgentStopCommand {
    agentId: string;
    runId: string;
    type: 'stop';
}

/** Server→Computer command to refresh instructions without rotating context. */
export interface AgentRestartCommand {
    agentId: string;
    type: 'agent-restart';
}

/** Server→Computer command to rotate one Agent's local execution state. */
export interface AgentResetCommand {
    agentId: string;
    kind: 'full' | 'session';
    sessionGeneration: number;
    type: 'agent-reset';
}

/** Server→Computer notice that a busy Agent has queued work. */
export interface AgentNoticeCommand {
    agentId: string;
    inbox: AgentInboxItem[];
    runId: string;
    totalPending: number;
    type: 'notice';
}

/** Server-scoped instruction to erase this attachment's local partition. */
export interface ServerDeleteCommand {
    type: 'server-delete';
}

/** The compact turn summary the Computer pushes up after a launch settles. */
export interface AgentTurnFrame {
    agentId: string;
    endedAt: string;
    failureKind?: RuntimeFailureKind;
    messageCount: number;
    modelId: string;
    /** Whether the turn produced any durable send — governs safe requeue. */
    outputProduced: boolean;
    runId: string;
    runtimeId: string;
    startedAt: string;
    status: 'completed' | 'failed';
    summary: string;
    tokenUsage: {
        cacheReadTokens: number;
        cacheWriteTokens: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    } | null;
    type: 'turn';
    visibleMessages: Array<{ chatId: string; id: string; sequence: number }>;
}

export interface RunAgentLaunchOptions {
    attachment: Attachment;
    command: AgentStartCommand;
    dataRoot: string;
    /** Commits the Server ack immediately before the runtime accepts the prompt. */
    onRuntimeReady?(): Promise<void>;
    /** Reports a persisted busy notice that was injected after sink registration. */
    onStoredNoticeDelivered?(receipt: StoredNoticeReceipt): void;
    /** Registers the live harness input used for content-free busy notices. */
    registerNoticeSink?: NoticeSinkRegistrar;
    /** Pushes the compact turn summary up the attachment socket. */
    sendFrame(frame: unknown): void;
    serverOrigin: string;
    /** Aborts the launch — a human Stop kills the live child through this. */
    signal?: AbortSignal;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const fakeRuntimePath = resolve(moduleDir, 'fake-runtime.ts');
/**
 * Runs one Agent launch: isolated logical home/workspace/skills/runtime, a
 * Computer-minted scoped runner credential kept behind a loopback proxy, and the
 * managed `grotto` wrapper on PATH as the Agent's sole output channel. Real
 * runtimes drive the `@ai-sdk/harness` Codex/Claude/Pi executor with the Agent's
 * one persistent session; the `fake` lane runs the deterministic real-CLI turn.
 * Raw traces stay in the local runtime directory; only a compact summary leaves.
 */
export async function runAgentLaunch(options: RunAgentLaunchOptions): Promise<AgentTurnFrame> {
    const startedAt = new Date().toISOString();
    const { command } = options;
    const agentRoot = join(
        options.dataRoot,
        'servers',
        options.attachment.serverId,
        'agents',
        command.agentId
    );
    const dirs = {
        home: join(agentRoot, 'home'),
        runtime: join(agentRoot, 'runtime'),
        skills: join(agentRoot, 'skills'),
        workspace: join(agentRoot, 'workspace'),
    };
    await Promise.all(
        Object.values(dirs).map((dir) => mkdir(dir, { mode: 0o700, recursive: true }))
    );
    await ensureNativeSkillLinks(dirs.home, dirs.skills);

    const runtimeCommand = runtimeCli[command.runtimeId];
    const runtimeExecutable = runtimeCommand ? resolveRuntimeExecutable(runtimeCommand) : null;
    if (command.runtimeId !== 'fake' && !runtimeExecutable) {
        return reportTurn(options, {
            failureKind: 'configuration',
            messageCount: 0,
            startedAt,
            status: 'failed',
            summary: `Runtime "${command.runtimeId}" is not installed.`,
        });
    }

    let runner: { runnerId: string; runnerToken: string };
    try {
        runner = await mintRunner(options);
    } catch (error) {
        return reportTurn(options, {
            failureKind: 'transport',
            messageCount: 0,
            startedAt,
            status: 'failed',
            summary: `Runner authority mint failed: ${messageOf(error)}`,
        });
    }

    const host = acquireAgentLaunchHost({
        agentId: command.agentId,
        dataRoot: options.dataRoot,
        runnerToken: runner.runnerToken,
        runId: command.runId,
        serverId: options.attachment.serverId,
        serverOrigin: options.serverOrigin,
        skillsDir: dirs.skills,
    });
    const { proxy, proxyToken } = host;
    let activitySequence = 0;
    const sendActivity = (activity: ComputerAgentActivityUpdate) => {
        const frame = {
            agentId: command.agentId,
            category: activity.category,
            occurredAt: new Date().toISOString(),
            phase: activity.phase,
            producerSequence: ++activitySequence,
            runId: command.runId,
            ...(activity.toolRef ? { toolRef: activity.toolRef } : {}),
            type: 'agent-activity' as const,
        };
        try {
            options.sendFrame(frame);
        } catch {
            // Activity is recoverable presentation metadata; a disconnected
            // socket must not turn a model turn into a delivery failure.
        }
    };
    proxy.setActivitySink(sendActivity);
    const tokenFile = join(dirs.runtime, 'proxy-token');
    const binDir = join(dirs.runtime, 'bin');
    await mkdir(binDir, { mode: 0o700, recursive: true });
    await writeFile(tokenFile, proxyToken, { mode: 0o600 });
    const wrapperPath = await writeGrottoWrapper({
        binDir,
        entrypoint: computerEntrypoint(),
        identity: {
            agentId: command.agentId,
            proxyTokenFile: tokenFile,
            proxyUrl: proxy.url,
            serverUrl: options.serverOrigin,
        },
    });
    // The Agent's only reachable authority is the loopback proxy token; the
    // managed `grotto` wrapper on PATH is its sole output channel.
    const agentEnv: Record<string, string> = {
        GROTTO_AGENT_ID: command.agentId,
        GROTTO_AGENT_PROXY_TOKEN_FILE: tokenFile,
        GROTTO_AGENT_PROXY_URL: proxy.url,
        GROTTO_AGENT_TOKEN_FILE: tokenFile,
        GROTTO_SERVER_URL: options.serverOrigin,
        GROTTO_WRAPPER: wrapperPath,
        PATH: [
            binDir,
            runtimeExecutable?.path ? dirname(runtimeExecutable.path) : null,
            runtimeExecutable?.searchPath ?? runtimeSearchPath(),
        ]
            .filter(Boolean)
            .join(':'),
    };

    let result: {
        failureKind?: RuntimeFailureKind;
        status: 'completed' | 'failed';
        tokenUsage?: AgentTurnFrame['tokenUsage'];
    } = {
        status: 'failed',
    };
    try {
        await options.onRuntimeReady?.();
        result =
            command.runtimeId === 'fake'
                ? {
                      status: await runFakeRuntime({
                          agentEnv,
                          command,
                          dataRoot: options.dataRoot,
                          dirs,
                          signal: options.signal,
                      }),
                  }
                : await runRealRuntime({
                      agentEnv,
                      agentRoot,
                      command,
                      dataRoot: options.dataRoot,
                      dirs,
                      onStoredNoticeDelivered: options.onStoredNoticeDelivered,
                      onActivity: sendActivity,
                      registerNoticeSink: options.registerNoticeSink,
                      tools: await createServerMcpTools({
                          proxyToken,
                          proxyUrl: proxy.url,
                      }),
                      signal: options.signal,
                  });
    } finally {
        await revokeRunner(options, runner.runnerId).catch(() => undefined);
        proxy.clearRunnerToken();
        proxy.setActivitySink(undefined);
    }

    return reportTurn(options, {
        messageCount: proxy.sendCount(),
        startedAt,
        ...result,
        summary:
            result.status === 'completed'
                ? completedTurnSummary(proxy.sendCount())
                : `The Agent turn did not complete (${result.failureKind ?? 'unknown'}).`,
        visibleMessages: await readRunVisibleMessages(
            {
                agentId: command.agentId,
                dataRoot: options.dataRoot,
                serverId: options.attachment.serverId,
            },
            command.runId
        ),
    });
}

function completedTurnSummary(messageCount: number) {
    return `Sent ${messageCount} message(s).`;
}

async function ensureNativeSkillLinks(homeDir: string, skillsDir: string) {
    for (const nativeDir of ['.agents', '.claude']) {
        const parent = join(homeDir, nativeDir);
        const target = join(parent, 'skills');
        await mkdir(parent, { mode: 0o700, recursive: true });
        try {
            await symlink(skillsDir, target, 'dir');
        } catch (cause) {
            if (
                !(
                    cause &&
                    typeof cause === 'object' &&
                    'code' in cause &&
                    cause.code === 'EEXIST' &&
                    (await readlink(target)) === skillsDir
                )
            ) {
                throw cause;
            }
        }
    }
}

/** Validates a Server→Computer frame as a launch command. Fails closed to null. */
export function parseStartCommand(frame: unknown): AgentStartCommand | null {
    if (!isRecord(frame) || frame.type !== 'start') {
        return null;
    }
    const idFields = ['agentId', 'chatId', 'modelId', 'runId', 'runtimeId'] as const;
    for (const field of idFields) {
        if (typeof frame[field] !== 'string' || (frame[field] as string).length === 0) {
            return null;
        }
    }
    const inbox = parseInbox(frame.inbox);
    if (!inbox) {
        return null;
    }
    if (
        typeof frame.sessionGeneration !== 'number' ||
        !Number.isInteger(frame.sessionGeneration) ||
        frame.sessionGeneration < 1
    ) {
        return null;
    }
    if (
        !['concrete', 'notice'].includes(frame.inboxDelivery as string) ||
        typeof frame.totalPending !== 'number' ||
        !Number.isInteger(frame.totalPending) ||
        frame.totalPending < 0
    ) {
        return null;
    }
    for (const field of ['agentDescription', 'agentName', 'homeTimezone'] as const) {
        if (frame[field] !== undefined && typeof frame[field] !== 'string') {
            return null;
        }
    }
    const webAccess = ['fetch-only', 'search', 'search-only'].includes(frame.webAccess as string)
        ? (frame.webAccess as 'fetch-only' | 'search' | 'search-only')
        : undefined;
    return {
        agentId: frame.agentId as string,
        ...(typeof frame.agentDescription === 'string'
            ? { agentDescription: frame.agentDescription }
            : {}),
        ...(typeof frame.agentName === 'string' ? { agentName: frame.agentName } : {}),
        chatId: frame.chatId as string,
        ...(typeof frame.homeTimezone === 'string' ? { homeTimezone: frame.homeTimezone } : {}),
        inbox,
        inboxDelivery: frame.inboxDelivery as 'concrete' | 'notice',
        modelId: frame.modelId as string,
        runId: frame.runId as string,
        runtimeId: frame.runtimeId as string,
        sessionGeneration: frame.sessionGeneration,
        totalPending: frame.totalPending,
        type: 'start',
        ...(webAccess ? { webAccess } : {}),
    };
}

/** Validates a Server→Computer frame as a stop command. Fails closed to null. */
export function parseStopCommand(frame: unknown): AgentStopCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'stop' ||
        typeof frame.agentId !== 'string' ||
        frame.agentId.length === 0 ||
        typeof frame.runId !== 'string' ||
        frame.runId.length === 0
    ) {
        return null;
    }
    return { agentId: frame.agentId, runId: frame.runId, type: 'stop' };
}

/** Validates a Server→Computer restart command. Fails closed to null. */
export function parseRestartCommand(frame: unknown): AgentRestartCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'agent-restart' ||
        typeof frame.agentId !== 'string' ||
        frame.agentId.length === 0
    ) {
        return null;
    }
    return { agentId: frame.agentId, type: 'agent-restart' };
}

/** Validates a Server→Computer reset command. Fails closed to null. */
export function parseResetCommand(frame: unknown): AgentResetCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'agent-reset' ||
        typeof frame.agentId !== 'string' ||
        frame.agentId.length === 0 ||
        !['full', 'session'].includes(frame.kind as string) ||
        typeof frame.sessionGeneration !== 'number' ||
        !Number.isInteger(frame.sessionGeneration) ||
        frame.sessionGeneration < 1
    ) {
        return null;
    }
    return {
        agentId: frame.agentId,
        kind: frame.kind as 'full' | 'session',
        sessionGeneration: frame.sessionGeneration,
        type: 'agent-reset',
    };
}

/** Applies reset semantics inside exactly one Server/Agent filesystem partition. */
export async function resetAgentState(input: {
    agentId: string;
    dataRoot: string;
    kind: 'full' | 'session';
    serverId: string;
}): Promise<void> {
    const agentRoot = join(input.dataRoot, 'servers', input.serverId, 'agents', input.agentId);
    if (input.kind === 'full') {
        const seed = await readAgentSeedConfiguration(agentRoot);
        await Promise.all(
            ['home', 'runtime', 'skills', 'workspace', '.agent-runs', 'session.json'].map((entry) =>
                rm(join(agentRoot, entry), { force: true, recursive: true })
            )
        );
        if (seed) {
            await Promise.all([
                seed.factoryKind === 'cove'
                    ? seedCoveWorkspace(join(agentRoot, 'workspace'))
                    : seedAgentWorkspace({
                          agentName: seed.agentName,
                          bio: seed.agentDescription,
                          workspaceDir: join(agentRoot, 'workspace'),
                      }),
                seedFactoryManagedSkills(join(agentRoot, 'skills')),
            ]);
        }
        return;
    }
    await Promise.all([
        rm(join(agentRoot, 'session.json'), { force: true }),
        rm(join(agentRoot, '.agent-runs'), { force: true, recursive: true }),
        rm(join(agentRoot, 'runtime', 'inbox'), { force: true, recursive: true }),
        rm(join(agentRoot, 'runtime', 'pending-notice.json'), { force: true }),
    ]);
}

/** Validates a Server→Computer busy-inbox snapshot. Fails closed to null. */
export function parseNoticeCommand(frame: unknown): AgentNoticeCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'notice' ||
        typeof frame.agentId !== 'string' ||
        frame.agentId.length === 0 ||
        typeof frame.runId !== 'string' ||
        frame.runId.length === 0 ||
        typeof frame.totalPending !== 'number' ||
        !Number.isInteger(frame.totalPending) ||
        frame.totalPending < 1 ||
        !parseInbox(frame.inbox)?.length
    ) {
        return null;
    }
    return {
        agentId: frame.agentId,
        inbox: parseInbox(frame.inbox) ?? [],
        runId: frame.runId,
        totalPending: frame.totalPending,
        type: 'notice',
    };
}

function parseInbox(value: unknown): AgentInboxItem[] | null {
    if (!Array.isArray(value) || value.length > 100) {
        return null;
    }
    const inbox: AgentInboxItem[] = [];
    for (const item of value) {
        if (
            !(
                isRecord(item) &&
                ['chatId', 'content', 'createdAt', 'id', 'senderHandle', 'target'].every(
                    (field) => typeof item[field] === 'string' && item[field].length > 0
                ) &&
                (item.senderDescription === undefined ||
                    typeof item.senderDescription === 'string') &&
                (item.message === undefined || isRecord(item.message)) &&
                (item.threadFollowReactivated === undefined ||
                    typeof item.threadFollowReactivated === 'boolean') &&
                ['agent', 'human', 'system'].includes(item.senderType as string)
            ) ||
            typeof item.sequence !== 'number' ||
            !Number.isInteger(item.sequence) ||
            item.sequence < 1
        ) {
            return null;
        }
        inbox.push(item as unknown as AgentInboxItem);
    }
    return inbox;
}

export function parseServerDeleteCommand(frame: unknown): ServerDeleteCommand | null {
    return isRecord(frame) && frame.type === 'server-delete' && Object.keys(frame).length === 1
        ? { type: 'server-delete' }
        : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function reportTurn(
    options: RunAgentLaunchOptions,
    input: {
        messageCount: number;
        failureKind?: RuntimeFailureKind;
        startedAt: string;
        status: 'completed' | 'failed';
        summary: string;
        tokenUsage?: AgentTurnFrame['tokenUsage'];
        visibleMessages?: Array<{ chatId: string; id: string; sequence: number }>;
    }
): AgentTurnFrame {
    const frame: AgentTurnFrame = {
        agentId: options.command.agentId,
        endedAt: new Date().toISOString(),
        ...(input.failureKind ? { failureKind: input.failureKind } : {}),
        messageCount: input.messageCount,
        modelId: options.command.modelId,
        outputProduced: input.messageCount > 0,
        runId: options.command.runId,
        runtimeId: options.command.runtimeId,
        startedAt: input.startedAt,
        status: input.status,
        summary: input.summary,
        tokenUsage: input.tokenUsage ?? null,
        type: 'turn',
        visibleMessages: input.visibleMessages ?? [],
    };
    options.sendFrame(frame);
    return frame;
}

interface RuntimeExecutionInput {
    agentEnv: Record<string, string>;
    command: AgentStartCommand;
    dataRoot: string;
    dirs: { home: string; runtime: string; skills: string; workspace: string };
    onActivity?: (activity: ComputerAgentActivityUpdate) => void;
    onStoredNoticeDelivered?: (receipt: StoredNoticeReceipt) => void;
    registerNoticeSink?: NoticeSinkRegistrar;
    signal?: AbortSignal;
}

/**
 * The deterministic real-harness lane: the real managed `grotto` CLI reaches the
 * Server through the loopback proxy, but the model is a local stub — no network
 * model call. It exercises the genuine output path for tests and the dev stack.
 */
async function runFakeRuntime(input: RuntimeExecutionInput): Promise<'completed' | 'failed'> {
    const child = Bun.spawn([process.execPath, fakeRuntimePath], {
        cwd: input.dirs.workspace,
        env: {
            ...process.env,
            ...input.agentEnv,
            GROTTO_TURN_PROMPT: composeInboxDrain(
                input.command.inbox ?? [],
                input.command.homeTimezone ?? 'UTC'
            ),
            HOME: input.dirs.home,
        },
        signal: input.signal,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [out, err, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ]);
    await writeTrace(input, `${out}${err}`);
    return exitCode === 0 ? 'completed' : 'failed';
}

/**
 * Drives a real `@ai-sdk/harness` executor (Codex/Claude Code/Pi) for the turn.
 * The Agent's replies leave exclusively through `grotto message send`, so a
 * completed turn is one whose harness stream settled without error; durable send
 * counting stays on the loopback proxy.
 */
async function runRealRuntime(
    input: RuntimeExecutionInput & {
        agentRoot: string;
        tools: import('@ai-sdk/provider-utils').ToolSet;
    }
): Promise<{
    failureKind?: RuntimeFailureKind;
    status: 'completed' | 'failed';
    tokenUsage?: AgentTurnFrame['tokenUsage'];
}> {
    const { command } = input;
    try {
        const turn = await runHarnessTurn({
            agentId: command.agentId,
            // The Server owns the Agent handle/description; sensible defaults keep
            // the managed contract intact when a facet is omitted.
            agentName: command.agentName ?? command.agentId,
            agentRoot: input.agentRoot,
            dataRoot: input.dataRoot,
            env: input.agentEnv,
            homeDir: input.dirs.home,
            homeTimezone: command.homeTimezone ?? 'UTC',
            initialRole: command.agentDescription ?? null,
            modelId: command.modelId,
            inbox: command.inbox ?? [],
            inboxDelivery: command.inboxDelivery,
            onStoredNoticeDelivered: input.onStoredNoticeDelivered,
            onActivity: input.onActivity,
            registerNoticeSink: input.registerNoticeSink,
            runId: command.runId,
            runtimeId: command.runtimeId,
            sessionGeneration: command.sessionGeneration,
            signal: input.signal,
            skillsDir: input.dirs.skills,
            totalPending: command.totalPending,
            webAccess: command.webAccess ?? null,
            workspaceDir: input.dirs.workspace,
            tools: input.tools,
        });
        await writeTrace(input, 'Harness turn completed.\n');
        return {
            status: turn.aborted ? 'failed' : 'completed',
            tokenUsage: turn.tokenUsage,
        };
    } catch (error) {
        await writeTrace(input, `Harness turn failed: ${messageOf(error)}\n`);
        const failure = error instanceof HarnessTurnFailedError ? error.cause : error;
        return {
            failureKind:
                failure instanceof AgentSessionResumeRejectedError
                    ? 'session-resume'
                    : classifyRuntimeFailure(failure),
            status: 'failed',
            tokenUsage: error instanceof HarnessTurnFailedError ? error.tokenUsage : null,
        };
    }
}

async function writeTrace(input: RuntimeExecutionInput, content: string) {
    // Raw traces are Computer-local; only the compact summary leaves.
    await writeFile(join(input.dirs.runtime, `turn-${input.command.runId}.log`), content, {
        mode: 0o600,
    });
}

/**
 * The runtimes the Computer can execute — kept in lockstep with the ids
 * `inventory.ts` advertises, so what a Server is offered and what the Computer
 * runs never diverge. `fake` is the always-available deterministic lane; the
 * real runtimes require their host CLI (native provider login lives there).
 */
const runtimeCli: Record<string, string> = {
    'claude-code': 'claude',
    codex: 'codex',
    pi: 'pi',
};

async function mintRunner(options: RunAgentLaunchOptions) {
    return await postJson<{ runnerId: string; runnerToken: string }>(
        options.serverOrigin,
        '/computer/runner/mint',
        {
            agentId: options.command.agentId,
            chatId: options.command.chatId,
            credentialHash: hash(options.attachment.credential),
            runId: options.command.runId,
        }
    );
}

async function revokeRunner(options: RunAgentLaunchOptions, runnerId: string) {
    await postJson(options.serverOrigin, '/computer/runner/revoke', {
        credentialHash: hash(options.attachment.credential),
        runnerId,
    });
}

async function postJson<Response>(origin: string, path: string, body: object): Promise<Response> {
    const response = await fetch(new URL(path, origin), {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    const payload = (await response.json()) as Response & { error?: string };
    if (!response.ok) {
        throw new Error(payload.error ?? 'The Computer request was rejected.');
    }
    return payload;
}

function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

function messageOf(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
