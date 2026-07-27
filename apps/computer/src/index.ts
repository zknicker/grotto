#!/usr/bin/env bun
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { arch, homedir, platform, userInfo } from 'node:os';
import { join } from 'node:path';
import { runAgentCli } from './agent-cli.ts';
import {
    decideStart,
    readRunMarker,
    reserveRun,
    writePendingNotice,
    writeRunMarker,
} from './delivery.ts';
import { detectInventory } from './inventory.ts';
import {
    type Attachment,
    type HostedAgentStartCommand,
    type HostedAgentTurnFrame,
    parseNoticeCommand,
    parseStartCommand,
    parseStopCommand,
    runAgentLaunch,
} from './launch.ts';
import { type AttachmentMcpConnection, AttachmentMcpRuntime } from './mcp-runtime.ts';

interface SetupResponse {
    approvalId: string;
    approvalUrl: string;
    serverId: string;
}

const dataRoot = process.env.GROTTO_COMPUTER_DATA_ROOT ?? join(homedir(), '.grotto', 'computer');
const serverOrigin = process.env.GROTTO_SERVER_ORIGIN ?? 'https://grotto.sh';

async function main(args: string[]) {
    const [command, target] = args;
    // The embedded Agent CLI. The managed `grotto` wrapper re-executes this
    // entrypoint; it is a separate command surface, not a separate artifact.
    if (command === '__agent') {
        process.exitCode = await runAgentCli(args.slice(1));
        return;
    }
    if (command === 'install') {
        await installResidentService();
        console.log('Grotto Computer resident service installed.');
        return;
    }
    if (command === 'start') {
        await rm(stoppedPath(), { force: true });
        await startAttachments(target);
        if (process.env.GROTTO_COMPUTER_RESIDENT === '1') {
            await new Promise<never>(() => undefined);
        }
        return;
    }
    if (command === 'stop') {
        if (target) {
            await stopAttachment(await requiredAttachment(target));
            return;
        }
        await writeFile(stoppedPath(), '', { mode: 0o600 });
        await Promise.all((await listAttachments()).map(stopAttachment));
        await stopResidentService();
        return;
    }
    if (command === 'restart') {
        const attachment = await requiredAttachment(target);
        await stopAttachment(attachment);
        await startAttachment(attachment);
        return;
    }
    if (command === 'run') {
        const attachment = await readAttachment(target);
        if (!attachment) {
            throw new Error('This Server is not attached to this Grotto Computer.');
        }
        await validate(attachment);
        await connect(attachment);
        return;
    }
    if (command !== 'setup' || !target?.startsWith('/')) {
        throw new Error('Usage: grotto-computer <install|start|stop|restart|setup /server-slug>');
    }
    const slug = target.slice(1);
    const current = await findAttachment(slug);
    if (current) {
        await validate(current);
        await startAttachment(current);
        console.log(`Grotto Computer resumed /${slug}.`);
        return;
    }
    const credential = randomBytes(32).toString('base64url');
    const started = await request<SetupResponse>('/computer/setup', {
        credentialHash: hash(credential),
        slug,
    });
    approvalSecrets.set(started.approvalId, approvalSecretFromUrl(started.approvalUrl));
    console.log(`Approve this Computer in your browser: ${started.approvalUrl}`);
    const attachment = await waitForApproval(
        started.approvalId,
        started.serverId,
        credential,
        slug
    );
    await writeAttachment(attachment);
    await startAttachment(attachment);
    console.log(`Grotto Computer attached to /${slug}.`);
}

async function startAttachments(target: string | undefined) {
    if (await isStopped()) {
        return;
    }
    if (target) {
        await startAttachment(await requiredAttachment(target));
        return;
    }
    await Promise.all((await listAttachments()).map(startAttachment));
}

async function requiredAttachment(target: string | undefined) {
    if (!target?.startsWith('/')) {
        throw new Error('Choose a Server as /server-slug.');
    }
    const attachment = await findAttachment(target.slice(1));
    if (!attachment) {
        throw new Error(`This Grotto Computer is not attached to ${target}.`);
    }
    return attachment;
}

async function findAttachment(slug: string): Promise<Attachment | null> {
    const root = join(dataRoot, 'servers');
    let ids: string[];
    try {
        ids = await readdir(root);
    } catch {
        return null;
    }
    for (const id of ids) {
        try {
            const attachment = JSON.parse(
                await readFile(join(root, id, 'attachment.json'), 'utf8')
            ) as Attachment;
            if (attachment.slug === slug) {
                return attachment;
            }
        } catch {
            // An incomplete attachment is never adopted.
        }
    }
    return null;
}

async function listAttachments() {
    const root = join(dataRoot, 'servers');
    let ids: string[];
    try {
        ids = await readdir(root);
    } catch {
        return [];
    }
    const attachments = await Promise.all(
        ids.map(async (id) => {
            try {
                return JSON.parse(
                    await readFile(join(root, id, 'attachment.json'), 'utf8')
                ) as Attachment;
            } catch {
                return null;
            }
        })
    );
    return attachments.filter((attachment): attachment is Attachment => attachment !== null);
}

async function readAttachment(serverId: string | undefined): Promise<Attachment | null> {
    if (!(serverId && /^[A-Za-z0-9_-]+$/u.test(serverId))) {
        return null;
    }
    try {
        return JSON.parse(
            await readFile(join(dataRoot, 'servers', serverId, 'attachment.json'), 'utf8')
        ) as Attachment;
    } catch {
        return null;
    }
}

async function validate(attachment: Attachment) {
    await request(
        '/computer/validate',
        { credentialHash: hash(attachment.credential), serverId: attachment.serverId },
        attachment.serverOrigin
    );
}

async function waitForApproval(
    approvalId: string,
    serverId: string,
    credential: string,
    slug: string
) {
    for (;;) {
        const response = await fetch(
            new URL(
                `/computer/setup/${approvalId}?secret=${encodeURIComponent(readApprovalSecret())}`,
                serverOrigin
            )
        );
        if (!response.ok) {
            const payload = (await response.json()) as { error?: string };
            throw new Error(payload.error ?? 'Computer approval was rejected.');
        }
        const status = (await response.json()) as {
            computerId?: string;
            status: 'approved' | 'pending';
        };
        if (status.status === 'approved' && status.computerId) {
            return {
                computerId: status.computerId,
                credential,
                serverOrigin,
                serverId,
                slug,
            } satisfies Attachment;
        }
        await Bun.sleep(1000);
    }
    function readApprovalSecret() {
        // The approval link is the only holder of this short-lived secret. The
        // local setup invocation keeps it in memory and never writes it.
        return approvalSecrets.get(approvalId) ?? '';
    }
}

const approvalSecrets = new Map<string, string>();

async function request<Response>(
    path: string,
    body: object,
    origin = serverOrigin
): Promise<Response> {
    const response = await fetch(new URL(path, origin), {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    const payload = (await response.json()) as Response & { error?: string };
    if (!response.ok) {
        throw new Error(payload.error ?? 'Computer request was rejected.');
    }
    return payload;
}

function approvalSecretFromUrl(approvalUrl: string) {
    const secret = new URL(approvalUrl).searchParams.get('secret');
    if (!secret) {
        throw new Error('Server returned an invalid Computer approval URL.');
    }
    return secret;
}

async function writeAttachment(attachment: Attachment) {
    const directory = join(dataRoot, 'servers', attachment.serverId);
    await mkdir(directory, { mode: 0o700, recursive: true });
    const destination = join(directory, 'attachment.json');
    const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, `${JSON.stringify(attachment)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
}

function stoppedPath() {
    return join(dataRoot, 'stopped');
}

async function isStopped() {
    try {
        await readFile(stoppedPath());
        return true;
    } catch {
        return false;
    }
}

async function startAttachment(attachment: Attachment) {
    if (await isRunnerAlive(attachment)) {
        return;
    }
    const child = Bun.spawn([process.execPath, process.argv[1] ?? '', 'run', attachment.serverId], {
        env: { ...process.env, GROTTO_COMPUTER_DATA_ROOT: dataRoot },
        stderr: 'inherit',
        stdin: 'ignore',
        stdout: 'inherit',
    });
    await writeFile(runnerPath(attachment), `${child.pid}\n`, { mode: 0o600 });
}

async function stopAttachment(attachment: Attachment) {
    try {
        const pid = Number.parseInt(await readFile(runnerPath(attachment), 'utf8'), 10);
        if (Number.isSafeInteger(pid) && pid > 0) {
            process.kill(pid, 'SIGTERM');
        }
    } catch {
        // A stopped or stale runner is already isolated from the other attachments.
    }
    await rm(runnerPath(attachment), { force: true });
}

function runnerPath(attachment: Attachment) {
    return join(dataRoot, 'servers', attachment.serverId, 'runner.pid');
}

async function isRunnerAlive(attachment: Attachment) {
    try {
        const pid = Number.parseInt(await readFile(runnerPath(attachment), 'utf8'), 10);
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function installResidentService() {
    const agentsRoot = join(homedir(), 'Library', 'LaunchAgents');
    const plistPath = join(agentsRoot, 'com.grotto.computer.plist');
    await mkdir(agentsRoot, { recursive: true });
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    await writeFile(plistPath, launchdPlist(process.execPath, process.argv[1] ?? ''), {
        mode: 0o600,
    });
    const domain = `gui/${userInfo().uid}`;
    const existing = Bun.spawnSync(['/bin/launchctl', 'bootout', domain, plistPath], {
        stderr: 'ignore',
        stdout: 'ignore',
    });
    if (existing.exitCode !== 0 && existing.exitCode !== 3) {
        throw new Error('Could not replace Grotto Computer service.');
    }
    const loaded = Bun.spawnSync(['/bin/launchctl', 'bootstrap', domain, plistPath], {
        stderr: 'ignore',
        stdout: 'ignore',
    });
    if (loaded.exitCode !== 0) {
        throw new Error('Could not start Grotto Computer service.');
    }
}

async function stopResidentService() {
    if (platform() !== 'darwin') {
        return;
    }
    const result = Bun.spawnSync([
        '/bin/launchctl',
        'bootout',
        `gui/${userInfo().uid}`,
        join(homedir(), 'Library', 'LaunchAgents', 'com.grotto.computer.plist'),
    ]);
    if (result.exitCode !== 0 && result.exitCode !== 3) {
        throw new Error('Could not stop Grotto Computer service.');
    }
}

export function launchdPlist(runtime: string, entrypoint: string) {
    const escaped = [runtime, entrypoint, 'start', dataRoot].map(escapeXml);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.grotto.computer</string><key>ProgramArguments</key><array><string>${escaped[0]}</string><string>${escaped[1]}</string><string>${escaped[2]}</string></array><key>EnvironmentVariables</key><dict><key>GROTTO_COMPUTER_DATA_ROOT</key><string>${escaped[3]}</string><key>GROTTO_COMPUTER_RESIDENT</key><string>1</string></dict><key>KeepAlive</key><true/><key>RunAtLoad</key><true/></dict></plist>\n`;
}

function escapeXml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

async function connect(attachment: Attachment) {
    const mcp = new AttachmentMcpRuntime(join(dataRoot, 'servers', attachment.serverId, 'mcp'));
    const socketUrl = new URL('/computer/attachment', attachment.serverOrigin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(socketUrl);
    // Live runs in this process, keyed by run so a Stop can kill the right child.
    const running = new Map<string, AbortController>();
    await new Promise<void>((resolve, reject) => {
        socket.addEventListener('error', () =>
            reject(new Error('Computer attachment socket failed.'))
        );
        socket.addEventListener('message', (event) => {
            const frame = JSON.parse(String(event.data)) as { type?: string };
            if (frame.type === 'accepted') {
                if (process.env.GROTTO_COMPUTER_ONESHOT === '1') {
                    socket.close();
                }
                resolve();
                return;
            }
            const mcpConnection = parseMcpUpsert(frame);
            if (mcpConnection) {
                void mcp
                    .upsert(mcpConnection)
                    .then(async () => {
                        socket.send(
                            JSON.stringify({
                                connectionId: mcpConnection.id,
                                tools: await mcp.listTools(mcpConnection.id),
                                type: 'mcp-inventory',
                            })
                        );
                    })
                    .catch((error) => {
                        console.error(error instanceof Error ? error.message : error);
                    });
                return;
            }
            const mcpGrant = parseMcpGrant(frame);
            if (mcpGrant) {
                mcp.setGrant(mcpGrant);
                return;
            }
            const mcpGrants = parseMcpGrants(frame);
            if (mcpGrants) {
                mcp.replaceAllGrants(mcpGrants);
                return;
            }
            const stop = parseStopCommand(frame);
            if (stop) {
                running.get(stop.runId)?.abort();
                return;
            }
            const notice = parseNoticeCommand(frame);
            if (notice) {
                void writePendingNotice(dataRoot, {
                    agentId: notice.agentId,
                    pending: notice.pending,
                    serverId: attachment.serverId,
                }).catch((error) => {
                    console.error(error instanceof Error ? error.message : error);
                });
                return;
            }
            const command = parseStartCommand(frame);
            if (command) {
                // Reserve the run synchronously, before any async marker I/O, so a
                // duplicate start frame that arrives mid-launch is deduped here
                // instead of racing into a second concurrent child.
                const controller = reserveRun(running, command.runId);
                if (!controller) {
                    socket.send(
                        JSON.stringify({
                            agentId: command.agentId,
                            runId: command.runId,
                            type: 'ack',
                        })
                    );
                    return;
                }
                void handleStartCommand({
                    attachment,
                    command,
                    controller,
                    mcpRuntime: mcp,
                    running,
                    socket,
                }).catch((error) => {
                    running.delete(command.runId);
                    console.error(error instanceof Error ? error.message : error);
                });
            }
        });
        socket.addEventListener('open', () => {
            socket.send(
                JSON.stringify({
                    architecture: arch(),
                    credential: attachment.credential,
                    health: 'healthy',
                    inventory: detectInventory(),
                    operatingSystem: platform(),
                    productVersion: '1.0.0',
                    protocolVersion: 1,
                    type: 'hello',
                })
            );
        });
    });
}

/**
 * Handles one start command idempotently. The run is already reserved in
 * `running` (synchronously, by the caller), so only one launch per run can exist.
 * Local acceptance (the durable marker plus the ack) is recorded before any model
 * work, so a dropped ack or a Computer restart resolves against the marker: a
 * settled run replays its summary and only a genuinely fresh run launches.
 */
async function handleStartCommand(input: {
    attachment: Attachment;
    command: HostedAgentStartCommand;
    controller: AbortController;
    mcpRuntime: AttachmentMcpRuntime;
    running: Map<string, AbortController>;
    socket: WebSocket;
}): Promise<void> {
    const { attachment, command, controller, mcpRuntime, running, socket } = input;
    const startedAt = new Date().toISOString();
    const send = (frame: unknown) => socket.send(JSON.stringify(frame));
    const ack = () => send({ agentId: command.agentId, runId: command.runId, type: 'ack' });
    const settle = async (summary: HostedAgentTurnFrame) => {
        send(summary);
        await writeRunMarker(dataRoot, {
            marker: { status: 'settled', summary },
            runId: command.runId,
            serverId: attachment.serverId,
        });
    };

    try {
        const marker = await readRunMarker(dataRoot, command, attachment.serverId);
        const decision = decideStart(marker);
        if (decision.kind === 'replay') {
            ack();
            send(decision.summary);
            return;
        }
        if (decision.kind === 'recover') {
            // Crashed after accepting this run; never rerun possibly-effectful
            // work. Report a failed, interrupted turn whose output is unknown, so
            // the Server does not requeue and duplicate it.
            ack();
            await settle(interruptedTurn(command, startedAt));
            return;
        }

        await writeRunMarker(dataRoot, {
            marker: { status: 'accepted' },
            runId: command.runId,
            serverId: attachment.serverId,
        });
        ack();

        let summary: HostedAgentTurnFrame;
        try {
            summary = await runAgentLaunch({
                attachment,
                command,
                dataRoot,
                mcpRuntime,
                sendFrame: send,
                serverOrigin,
                signal: controller.signal,
            });
        } catch (error) {
            // A crash after the ack must still report a terminal turn, or the
            // Server's in-flight run never settles. The launch failed before any
            // managed send, so the work is safe to requeue (outputProduced false).
            summary = launchCrashTurn(command, startedAt, error);
            await settle(summary);
            return;
        }
        await writeRunMarker(dataRoot, {
            marker: { status: 'settled', summary },
            runId: command.runId,
            serverId: attachment.serverId,
        });
    } finally {
        running.delete(command.runId);
    }
}

function interruptedTurn(
    command: HostedAgentStartCommand,
    startedAt: string
): HostedAgentTurnFrame {
    return {
        agentId: command.agentId,
        endedAt: new Date().toISOString(),
        messageCount: 0,
        // Output is unknown after a crash; assume it happened so the Server does
        // not requeue and risk duplicating it.
        outputProduced: true,
        runId: command.runId,
        startedAt,
        status: 'failed',
        summary: 'The Agent turn was interrupted and could not be resumed.',
        type: 'turn',
    };
}

function launchCrashTurn(
    command: HostedAgentStartCommand,
    startedAt: string,
    error: unknown
): HostedAgentTurnFrame {
    return {
        agentId: command.agentId,
        endedAt: new Date().toISOString(),
        messageCount: 0,
        outputProduced: false,
        runId: command.runId,
        startedAt,
        status: 'failed',
        summary: `The Agent launch failed: ${error instanceof Error ? error.message : String(error)}`,
        type: 'turn',
    };
}

function parseMcpGrants(frame: unknown) {
    if (
        typeof frame !== 'object' ||
        frame === null ||
        !('type' in frame) ||
        frame.type !== 'mcp-grants' ||
        !('grants' in frame) ||
        !Array.isArray(frame.grants)
    ) {
        return null;
    }
    const grants = frame.grants.filter(
        (grant): grant is { agentId: string; connectionId: string; toolName: string } =>
            typeof grant === 'object' &&
            grant !== null &&
            'agentId' in grant &&
            typeof grant.agentId === 'string' &&
            'connectionId' in grant &&
            typeof grant.connectionId === 'string' &&
            'toolName' in grant &&
            typeof grant.toolName === 'string'
    );
    return grants.length === frame.grants.length ? grants : null;
}

function parseMcpGrant(frame: unknown) {
    if (
        typeof frame !== 'object' ||
        frame === null ||
        !('type' in frame) ||
        frame.type !== 'mcp-grant' ||
        !('grant' in frame) ||
        typeof frame.grant !== 'object' ||
        frame.grant === null
    ) {
        return null;
    }
    const grant = frame.grant as Record<string, unknown>;
    if (
        typeof grant.agentId !== 'string' ||
        typeof grant.connectionId !== 'string' ||
        typeof grant.toolName !== 'string' ||
        typeof grant.enabled !== 'boolean'
    ) {
        return null;
    }
    return grant as { agentId: string; connectionId: string; enabled: boolean; toolName: string };
}

function parseMcpUpsert(frame: unknown): AttachmentMcpConnection | null {
    if (
        typeof frame !== 'object' ||
        frame === null ||
        !('type' in frame) ||
        frame.type !== 'mcp-upsert' ||
        !('connection' in frame) ||
        typeof frame.connection !== 'object' ||
        frame.connection === null
    ) {
        return null;
    }
    const connection = frame.connection as Record<string, unknown>;
    if (
        typeof connection.id !== 'string' ||
        typeof connection.name !== 'string' ||
        !(typeof connection.command === 'string' || connection.command === null) ||
        !(typeof connection.url === 'string' || connection.url === null) ||
        !Array.isArray(connection.args) ||
        typeof connection.env !== 'object' ||
        connection.env === null ||
        typeof connection.headers !== 'object' ||
        connection.headers === null
    ) {
        return null;
    }
    return connection as unknown as AttachmentMcpConnection;
}

function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

if (import.meta.main) {
    void main(process.argv.slice(2)).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
