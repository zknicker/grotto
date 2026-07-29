import { createHash } from 'node:crypto';
import { mkdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedAgentWorkspace } from '@tavern/agent-workspace';
import { readAgentSeedConfiguration } from './agent-configuration.ts';
import { acquireAgentLaunchHost } from './agent-launch-host.ts';
import { computerEntrypoint } from './build-identity.ts';
import { type NoticeSinkRegistrar, runHarnessTurn } from './harness/executor.ts';
import { composeInboxDrain } from './inbox-format.ts';
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
 * wire shapes (like `inventory.ts`) rather than importing the hosted contract
 * package, keeping the Computer artifact self-contained.
 */
export interface HostedAgentStartCommand {
    /** Server-owned Agent facts the Computer composes into the system prompt. */
    agentDescription?: string;
    agentId: string;
    agentName?: string;
    chatId: string;
    homeTimezone?: string;
    inbox?: HostedAgentInboxItem[];
    modelId: string;
    runId: string;
    runtimeId: string;
    type: 'start';
    webAccess?: 'fetch-only' | 'search' | 'search-only';
}

export interface HostedAgentInboxItem {
    chatId: string;
    content: string;
    createdAt: string;
    id: string;
    senderDescription?: string;
    senderHandle: string;
    senderType: 'agent' | 'human' | 'system';
    sequence: number;
    target: string;
}

/** Server→Computer command to terminate the named in-flight run. */
export interface HostedAgentStopCommand {
    agentId: string;
    runId: string;
    type: 'stop';
}

/** Server→Computer command to rotate one Agent's local execution state. */
export interface HostedAgentResetCommand {
    agentId: string;
    kind: 'full' | 'session';
    type: 'agent-reset';
}

/** Server→Computer notice that a busy Agent has queued work. */
export interface HostedAgentNoticeCommand {
    agentId: string;
    inbox: HostedAgentInboxItem[];
    runId: string;
    type: 'notice';
}

/** Server-scoped instruction to erase this attachment's local partition. */
export interface HostedServerDeleteCommand {
    type: 'server-delete';
}

/** The compact turn summary the Computer pushes up after a launch settles. */
export interface HostedAgentTurnFrame {
    agentId: string;
    endedAt: string;
    failureKind?: RuntimeFailureKind;
    messageCount: number;
    /** Whether the turn produced any durable send — governs safe requeue. */
    outputProduced: boolean;
    runId: string;
    startedAt: string;
    status: 'completed' | 'failed';
    summary: string;
    type: 'turn';
}

export interface RunAgentLaunchOptions {
    attachment: Attachment;
    command: HostedAgentStartCommand;
    dataRoot: string;
    /** Commits the Server ack immediately before the runtime accepts the prompt. */
    onRuntimeReady?(): Promise<void>;
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
export async function runAgentLaunch(
    options: RunAgentLaunchOptions
): Promise<HostedAgentTurnFrame> {
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
        serverId: options.attachment.serverId,
        serverOrigin: options.serverOrigin,
        skillsDir: dirs.skills,
    });
    const { proxy, proxyToken } = host;
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

    let result: { failureKind?: RuntimeFailureKind; status: 'completed' | 'failed' } = {
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
                          dirs,
                          signal: options.signal,
                      }),
                  }
                : await runRealRuntime({
                      agentEnv,
                      agentRoot,
                      command,
                      dirs,
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
    }

    return reportTurn(options, {
        messageCount: proxy.sendCount(),
        startedAt,
        ...result,
        summary:
            result.status === 'completed'
                ? `Sent ${proxy.sendCount()} message(s).`
                : `The Agent turn did not complete (${result.failureKind ?? 'unknown'}).`,
    });
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
export function parseStartCommand(frame: unknown): HostedAgentStartCommand | null {
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
        modelId: frame.modelId as string,
        runId: frame.runId as string,
        runtimeId: frame.runtimeId as string,
        type: 'start',
        ...(webAccess ? { webAccess } : {}),
    };
}

/** Validates a Server→Computer frame as a stop command. Fails closed to null. */
export function parseStopCommand(frame: unknown): HostedAgentStopCommand | null {
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

/** Validates a Server→Computer reset command. Fails closed to null. */
export function parseResetCommand(frame: unknown): HostedAgentResetCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'agent-reset' ||
        typeof frame.agentId !== 'string' ||
        frame.agentId.length === 0 ||
        !['full', 'session'].includes(frame.kind as string)
    ) {
        return null;
    }
    return {
        agentId: frame.agentId,
        kind: frame.kind as 'full' | 'session',
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
            await seedAgentWorkspace({
                agentName: seed.agentName,
                archetype: seed.archetype,
                bio: seed.agentDescription,
                workspaceDir: join(agentRoot, 'workspace'),
            });
        }
        return;
    }
    await Promise.all([
        rm(join(agentRoot, 'session.json'), { force: true }),
        rm(join(agentRoot, '.agent-runs'), { force: true, recursive: true }),
    ]);
}

/** Validates a Server→Computer busy-inbox snapshot. Fails closed to null. */
export function parseNoticeCommand(frame: unknown): HostedAgentNoticeCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'notice' ||
        typeof frame.agentId !== 'string' ||
        frame.agentId.length === 0 ||
        typeof frame.runId !== 'string' ||
        frame.runId.length === 0 ||
        !parseInbox(frame.inbox)?.length
    ) {
        return null;
    }
    return {
        agentId: frame.agentId,
        inbox: parseInbox(frame.inbox) ?? [],
        runId: frame.runId,
        type: 'notice',
    };
}

function parseInbox(value: unknown): HostedAgentInboxItem[] | null {
    if (!Array.isArray(value) || value.length > 100) {
        return null;
    }
    const inbox: HostedAgentInboxItem[] = [];
    for (const item of value) {
        if (
            !(
                isRecord(item) &&
                ['chatId', 'content', 'createdAt', 'id', 'senderHandle', 'target'].every(
                    (field) => typeof item[field] === 'string' && item[field].length > 0
                ) &&
                (item.senderDescription === undefined ||
                    typeof item.senderDescription === 'string') &&
                ['agent', 'human', 'system'].includes(item.senderType as string)
            ) ||
            typeof item.sequence !== 'number' ||
            !Number.isInteger(item.sequence) ||
            item.sequence < 1
        ) {
            return null;
        }
        inbox.push(item as unknown as HostedAgentInboxItem);
    }
    return inbox;
}

export function parseServerDeleteCommand(frame: unknown): HostedServerDeleteCommand | null {
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
    }
): HostedAgentTurnFrame {
    const frame: HostedAgentTurnFrame = {
        agentId: options.command.agentId,
        endedAt: new Date().toISOString(),
        ...(input.failureKind ? { failureKind: input.failureKind } : {}),
        messageCount: input.messageCount,
        outputProduced: input.messageCount > 0,
        runId: options.command.runId,
        startedAt: input.startedAt,
        status: input.status,
        summary: input.summary,
        type: 'turn',
    };
    options.sendFrame(frame);
    return frame;
}

interface RuntimeExecutionInput {
    agentEnv: Record<string, string>;
    command: HostedAgentStartCommand;
    dirs: { home: string; runtime: string; skills: string; workspace: string };
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
): Promise<{ failureKind?: RuntimeFailureKind; status: 'completed' | 'failed' }> {
    const { command } = input;
    try {
        await runHarnessTurn({
            agentId: command.agentId,
            // The Server owns the Agent handle/description; sensible defaults keep
            // the managed contract intact when a facet is omitted.
            agentName: command.agentName ?? command.agentId,
            agentRoot: input.agentRoot,
            env: input.agentEnv,
            homeDir: input.dirs.home,
            homeTimezone: command.homeTimezone ?? 'UTC',
            initialRole: command.agentDescription ?? null,
            modelId: command.modelId,
            inbox: command.inbox ?? [],
            registerNoticeSink: input.registerNoticeSink,
            runtimeId: command.runtimeId,
            signal: input.signal,
            skillsDir: input.dirs.skills,
            webAccess: command.webAccess ?? null,
            workspaceDir: input.dirs.workspace,
            tools: input.tools,
        });
        await writeTrace(input, 'Harness turn completed.\n');
        return { status: 'completed' };
    } catch (error) {
        await writeTrace(input, `Harness turn failed: ${messageOf(error)}\n`);
        return { failureKind: classifyRuntimeFailure(error), status: 'failed' };
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
