#!/usr/bin/env bun
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { arch, homedir, platform, userInfo } from 'node:os';
import { join } from 'node:path';
import { runAgentCli } from './agent-cli.ts';
import { detectInventory } from './inventory.ts';
import { type Attachment, parseStartCommand, runAgentLaunch } from './launch.ts';
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
        await Promise.all(
            (await listAttachments()).map(async (attachment) => {
                await validate(attachment);
                await connect(attachment);
            })
        );
        return;
    }
    if (command !== 'setup' || !target?.startsWith('/')) {
        throw new Error('Usage: grotto-computer <install|start|setup /server-slug>');
    }
    const slug = target.slice(1);
    const current = await findAttachment(slug);
    if (current) {
        await validate(current);
        await connect(current);
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
    await connect(attachment);
    console.log(`Grotto Computer attached to /${slug}.`);
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

async function validate(attachment: Attachment) {
    await request('/computer/validate', {
        credentialHash: hash(attachment.credential),
        serverId: attachment.serverId,
    });
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

async function request<Response>(path: string, body: object): Promise<Response> {
    const response = await fetch(new URL(path, serverOrigin), {
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

export function launchdPlist(runtime: string, entrypoint: string) {
    const escaped = [runtime, entrypoint, 'start', dataRoot].map(escapeXml);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.grotto.computer</string><key>ProgramArguments</key><array><string>${escaped[0]}</string><string>${escaped[1]}</string><string>${escaped[2]}</string></array><key>EnvironmentVariables</key><dict><key>GROTTO_COMPUTER_DATA_ROOT</key><string>${escaped[3]}</string></dict><key>KeepAlive</key><true/><key>RunAtLoad</key><true/></dict></plist>\n`;
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
    const socketUrl = new URL('/computer/attachment', serverOrigin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(socketUrl);
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
            const command = parseStartCommand(frame);
            if (command) {
                // One isolated launch per typed start. The Server enforces one
                // in-flight run per Agent, so a launch here is always the owner.
                void runAgentLaunch({
                    attachment,
                    command,
                    dataRoot,
                    mcpRuntime: mcp,
                    sendFrame: (payload) => socket.send(JSON.stringify(payload)),
                    serverOrigin,
                }).catch((error) => {
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
    return grant as {
        agentId: string;
        connectionId: string;
        enabled: boolean;
        toolName: string;
    };
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
