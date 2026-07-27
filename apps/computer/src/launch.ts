import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AttachmentMcpRuntime } from './mcp-runtime.ts';
import { startLoopbackProxy } from './proxy.ts';
import { writeGrottoWrapper } from './wrapper.ts';

export interface Attachment {
    computerId: string;
    credential: string;
    serverId: string;
    slug: string;
}

/**
 * The Server→Computer launch command. The Computer owns its own copy of the
 * wire shapes (like `inventory.ts`) rather than importing the hosted contract
 * package, keeping the Computer artifact self-contained.
 */
export interface HostedAgentStartCommand {
    agentId: string;
    chatId: string;
    modelId: string;
    prompt: string;
    runId: string;
    runtimeId: string;
    type: 'start';
}

export interface RunAgentLaunchOptions {
    attachment: Attachment;
    command: HostedAgentStartCommand;
    dataRoot: string;
    mcpRuntime: AttachmentMcpRuntime;
    /** Pushes the compact turn summary up the attachment socket. */
    sendFrame(frame: unknown): void;
    serverOrigin: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const fakeRuntimePath = resolve(moduleDir, 'fake-runtime.ts');
const computerEntry = resolve(moduleDir, 'index.ts');

/**
 * Runs one Agent launch: isolated logical home/workspace/skills/runtime, a
 * Computer-minted scoped runner credential kept behind a loopback proxy, the
 * managed `grotto` wrapper on PATH, and a deterministic runtime that produces a
 * durable hosted message. Raw traces stay in the local runtime directory; only
 * a compact summary is reported to the Server.
 */
export async function runAgentLaunch(options: RunAgentLaunchOptions): Promise<void> {
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

    const runtimeCommand = resolveRuntimeCommand(command.runtimeId);
    if (!runtimeCommand) {
        reportTurn(options, {
            messageCount: 0,
            startedAt,
            status: 'failed',
            summary: `Runtime "${command.runtimeId}" is not installed.`,
        });
        return;
    }

    let runner: { runnerId: string; runnerToken: string };
    try {
        runner = await mintRunner(options);
    } catch (error) {
        reportTurn(options, {
            messageCount: 0,
            startedAt,
            status: 'failed',
            summary: `Runner authority mint failed: ${messageOf(error)}`,
        });
        return;
    }

    const proxyToken = randomBytes(32).toString('base64url');
    const proxy = startLoopbackProxy({
        proxyToken,
        runnerToken: runner.runnerToken,
        serverOrigin: options.serverOrigin,
    });
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
    const mcpEndpoint = startMcpEndpoint(options.mcpRuntime, command.agentId, proxyToken);

    let status: 'completed' | 'failed' = 'failed';
    try {
        const child = Bun.spawn(runtimeCommand, {
            cwd: dirs.workspace,
            env: {
                ...process.env,
                GROTTO_AGENT_ID: command.agentId,
                GROTTO_AGENT_PROXY_TOKEN_FILE: tokenFile,
                GROTTO_AGENT_PROXY_URL: proxy.url,
                GROTTO_MCP_URL: mcpEndpoint.url,
                GROTTO_MCP_TOKEN: proxyToken,
                GROTTO_SERVER_URL: options.serverOrigin,
                GROTTO_TURN_PROMPT: command.prompt,
                GROTTO_WRAPPER: wrapperPath,
                HOME: dirs.home,
                PATH: `${binDir}:${process.env.PATH ?? ''}`,
            },
            stderr: 'pipe',
            stdout: 'pipe',
        });
        const [out, err, exitCode] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
        ]);
        // Raw traces are Computer-local; only the compact summary leaves.
        await writeFile(join(dirs.runtime, `turn-${command.runId}.log`), `${out}${err}`, {
            mode: 0o600,
        });
        status = exitCode === 0 ? 'completed' : 'failed';
    } finally {
        await revokeRunner(options, runner.runnerId).catch(() => undefined);
        await rm(tokenFile, { force: true });
        proxy.close();
        mcpEndpoint.close();
    }

    reportTurn(options, {
        messageCount: proxy.sendCount(),
        startedAt,
        status,
        summary:
            status === 'completed'
                ? `Sent ${proxy.sendCount()} message(s).`
                : 'The Agent turn did not complete.',
    });
}

function startMcpEndpoint(runtime: AttachmentMcpRuntime, agentId: string, token: string) {
    const server = Bun.serve({
        async fetch(request) {
            if (request.headers.get('authorization') !== `Bearer ${token}`) {
                return Response.json({ error: 'MCP authority was rejected.' }, { status: 401 });
            }
            try {
                const body = (await request.json()) as {
                    args?: unknown;
                    connectionId?: string;
                    toolName?: string;
                };
                if (!(body.connectionId && body.toolName)) {
                    return Response.json({ error: 'Invalid MCP invocation.' }, { status: 400 });
                }
                return Response.json({
                    result: await runtime.invoke({
                        agentId,
                        args: body.args ?? {},
                        connectionId: body.connectionId,
                        toolName: body.toolName,
                    }),
                });
            } catch (error) {
                return Response.json(
                    { error: error instanceof Error ? error.message : String(error) },
                    { status: 403 }
                );
            }
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    return {
        close: () => server.stop(true),
        url: `http://127.0.0.1:${server.port}`,
    };
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
    if (typeof frame.prompt !== 'string') {
        return null;
    }
    return {
        agentId: frame.agentId as string,
        chatId: frame.chatId as string,
        modelId: frame.modelId as string,
        prompt: frame.prompt as string,
        runId: frame.runId as string,
        runtimeId: frame.runtimeId as string,
        type: 'start',
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function reportTurn(
    options: RunAgentLaunchOptions,
    input: {
        messageCount: number;
        startedAt: string;
        status: 'completed' | 'failed';
        summary: string;
    }
): void {
    options.sendFrame({
        agentId: options.command.agentId,
        endedAt: new Date().toISOString(),
        messageCount: input.messageCount,
        runId: options.command.runId,
        startedAt: input.startedAt,
        status: input.status,
        summary: input.summary,
        type: 'turn',
    });
}

function resolveRuntimeCommand(runtimeId: string): string[] | null {
    // WS6 ships one deterministic runtime for the execution slice; real
    // executors resolve their PATH CLIs here as they land.
    if (runtimeId === 'fake') {
        return [process.execPath, fakeRuntimePath];
    }
    return null;
}

function computerEntrypoint(): { args: string[]; executable: string } {
    // Resolved from this module, not argv, so the wrapper always re-executes
    // the Computer's Agent CLI entrypoint even under a test runner.
    return { args: [computerEntry], executable: process.execPath };
}

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
