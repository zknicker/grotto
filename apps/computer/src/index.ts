#!/usr/bin/env bun
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { arch, homedir, platform, userInfo } from 'node:os';
import { join } from 'node:path';
import { runAgentCli } from './agent-cli.ts';
import { applyAgentConfiguration, parseAgentConfigureCommand } from './agent-configuration.ts';
import { computerEntrypoint, computerSourceRevision, computerVersion } from './build-identity.ts';
import {
    decideStart,
    purgeServerPartition,
    readRunMarker,
    releaseAgentRun,
    reserveAgentRun,
    writePendingNotice,
    writeRunMarker,
} from './delivery.ts';
import {
    doctorComputer,
    formatComputerStatus,
    formatDoctor,
    readComputerLogs,
    readComputerStatus,
} from './diagnostics.ts';
import { readEffectiveAgentStates } from './effective-state.ts';
import {
    importHostSkill,
    listAgentSkillReports,
    listImportableSkills,
    parseAgentSkillImportCommand,
} from './host-skills.ts';
import { detectInventory } from './inventory.ts';
import {
    type Attachment,
    type HostedAgentStartCommand,
    type HostedAgentTurnFrame,
    parseNoticeCommand,
    parseResetCommand,
    parseServerDeleteCommand,
    parseStartCommand,
    parseStopCommand,
    resetAgentState,
    runAgentLaunch,
} from './launch.ts';
import { parseReminderScriptCommand, runReminderScript } from './reminder-script.ts';
import {
    admitActiveRun,
    progress,
    readProductionRelease,
    readUpdateProgress,
    rollbackComputer,
    runSignedUpdate,
    writeUpdateProgress,
} from './update.ts';
import {
    computerBootstrapProtocolVersion,
    computerProtocolVersion,
    type ComputerUpdateProgress,
    parseBootstrapAccepted,
    parseComputerUpdateCommand,
} from './update-contract.ts';
import { parseAgentWorkspaceRequest, runAgentWorkspaceRequest } from './workspace-files.ts';

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
    if (command === 'upgrade') {
        if (target === '--rollback') {
            await rollbackComputer({ restart: restartAfterUpdate });
            console.log('Grotto Computer restored the previous verified executable.');
            return;
        }
        const release = await readProductionRelease();
        await runSignedUpdate({
            dataRoot,
            release,
            restart: restartAfterUpdate,
        });
        return;
    }
    if (command === '--version' || command === 'version') {
        console.log(
            JSON.stringify({
                protocolVersion: computerProtocolVersion,
                sourceRevision: computerSourceRevision,
                version: computerVersion,
            })
        );
        return;
    }
    if (command === 'status') {
        console.log(formatComputerStatus(await readComputerStatus(dataRoot)));
        return;
    }
    if (command === 'doctor') {
        const result = await doctorComputer(dataRoot, validate);
        console.log(formatDoctor(result));
        if (!result.healthy) {
            process.exitCode = 1;
        }
        return;
    }
    if (command === 'logs') {
        const requestedLines = Number.parseInt(target ?? '200', 10);
        process.stdout.write(
            await readComputerLogs(
                dataRoot,
                Number.isSafeInteger(requestedLines) ? requestedLines : 200
            )
        );
        return;
    }
    if (command === 'start') {
        await recoverInterruptedUpdate();
        await finishRestart();
        await rm(stoppedPath(), { force: true });
        await startAttachments(target);
        if (process.env.GROTTO_COMPUTER_RESIDENT === '1') {
            for (;;) {
                await Bun.sleep(500);
                await startAttachments(target);
            }
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
        throw new Error(
            'Usage: grotto-computer <install|upgrade [--rollback]|start|stop|restart|status|doctor|logs|version|setup /server-slug>'
        );
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
    const marker = await readRunnerMarker(attachment);
    if (marker && isPidAlive(marker.pid) && marker.credentialHash === hash(attachment.credential)) {
        return;
    }
    if (marker && isPidAlive(marker.pid)) {
        process.kill(marker.pid, 'SIGTERM');
    }
    const entrypoint = computerEntrypoint();
    const child = Bun.spawn(
        [entrypoint.executable, ...entrypoint.args, 'run', attachment.serverId],
        {
            env: {
                ...process.env,
                GROTTO_COMPUTER_DATA_ROOT: dataRoot,
                GROTTO_COMPUTER_RUNNER: '1',
            },
            stderr: 'inherit',
            stdin: 'ignore',
            stdout: 'inherit',
        }
    );
    await writeFile(
        runnerPath(attachment),
        `${JSON.stringify({ credentialHash: hash(attachment.credential), pid: child.pid })}\n`,
        { mode: 0o600 }
    );
}

async function stopAttachment(attachment: Attachment) {
    const marker = await readRunnerMarker(attachment);
    try {
        if (marker && isPidAlive(marker.pid)) {
            process.kill(marker.pid, 'SIGTERM');
        }
    } catch {
        // A stopped or stale runner is already isolated from the other attachments.
    }
    await rm(runnerPath(attachment), { force: true });
}

function runnerPath(attachment: Attachment) {
    return join(dataRoot, 'servers', attachment.serverId, 'runner.pid');
}

async function readRunnerMarker(
    attachment: Attachment
): Promise<{ credentialHash: string | null; pid: number } | null> {
    try {
        const contents = await readFile(runnerPath(attachment), 'utf8');
        const legacyPid = Number.parseInt(contents, 10);
        if (Number.isSafeInteger(legacyPid) && legacyPid > 0) {
            return { credentialHash: null, pid: legacyPid };
        }
        const marker = JSON.parse(contents) as { credentialHash?: unknown; pid?: unknown };
        if (
            typeof marker.credentialHash !== 'string' ||
            !/^[a-f0-9]{64}$/u.test(marker.credentialHash) ||
            !Number.isSafeInteger(marker.pid) ||
            (marker.pid as number) <= 0
        ) {
            return null;
        }
        return { credentialHash: marker.credentialHash, pid: marker.pid as number };
    } catch {
        return null;
    }
}

function isPidAlive(pid: number) {
    try {
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
    await mkdir(join(dataRoot, 'logs'), { mode: 0o700, recursive: true });
    await writeFile(plistPath, launchdPlist(computerEntrypoint()), {
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

async function restartAfterUpdate() {
    for (const attachment of await listAttachments()) {
        try {
            const marker = await readRunnerMarker(attachment);
            if (marker && marker.pid !== process.pid && isPidAlive(marker.pid)) {
                process.kill(marker.pid, 'SIGTERM');
            }
        } catch {
            // A missing runner is already ready for the resident restart.
        }
        await rm(runnerPath(attachment), { force: true });
    }
    await installResidentService();
    if (process.env.GROTTO_COMPUTER_RUNNER === '1') {
        setTimeout(() => process.exit(0), 100);
    }
}

async function finishRestart() {
    const current = await readUpdateProgress(dataRoot);
    if (current.phase !== 'restarting') {
        return;
    }
    await writeUpdateProgress(
        dataRoot,
        progress('complete', current.targetVersion, 'Grotto Computer updated successfully.')
    );
}

export async function recoverInterruptedUpdate(root = dataRoot) {
    const current = await readUpdateProgress(root);
    if (!isInterruptedUpdatePhase(current.phase)) {
        return;
    }
    await writeUpdateProgress(
        root,
        progress(
            'failed',
            current.targetVersion,
            'Update was interrupted. Retry in Settings or run grotto-computer upgrade locally.',
            {
                downloadedBytes: current.downloadedBytes,
                failedPhase: current.phase,
                totalBytes: current.totalBytes,
            }
        )
    );
}

function isInterruptedUpdatePhase(
    phase: ComputerUpdateProgress['phase']
): phase is 'downloading' | 'installing' | 'requested' | 'verifying' | 'waiting-for-agents' {
    return ['requested', 'downloading', 'verifying', 'installing', 'waiting-for-agents'].includes(
        phase
    );
}

export function launchdPlist(entrypoint: { args: string[]; executable: string }) {
    const escaped = [entrypoint.executable, ...entrypoint.args, 'start', dataRoot].map(escapeXml);
    const programArguments = escaped
        .slice(0, -1)
        .map((value) => `<string>${value}</string>`)
        .join('');
    const logPath = escapeXml(join(dataRoot, 'logs', 'computer.log'));
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.grotto.computer</string><key>ProgramArguments</key><array>${programArguments}</array><key>EnvironmentVariables</key><dict><key>GROTTO_COMPUTER_DATA_ROOT</key><string>${escaped.at(-1)}</string><key>GROTTO_COMPUTER_RESIDENT</key><string>1</string></dict><key>StandardOutPath</key><string>${logPath}</string><key>StandardErrorPath</key><string>${logPath}</string><key>KeepAlive</key><true/><key>RunAtLoad</key><true/></dict></plist>\n`;
}

function escapeXml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

async function connect(attachment: Attachment) {
    const socketUrl = new URL('/computer/attachment', attachment.serverOrigin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const initialProgress = await readUpdateProgress(dataRoot);
    const socket = new WebSocket(socketUrl);
    // Live runs in this process, keyed by run so a Stop can kill the right child.
    const running = new Map<string, AbortController>();
    const agentRuns = new Map<string, string>();
    const noticeSinks = new Map<
        string,
        { deliver: (pending: number) => Promise<boolean>; runId: string }
    >();
    const resettingAgents = new Set<string>();
    const pendingWriters = new Set<Promise<unknown>>();
    let deleting = false;
    const trackWriter = <Result>(operation: Promise<Result>) => {
        pendingWriters.add(operation);
        operation.then(
            () => pendingWriters.delete(operation),
            () => pendingWriters.delete(operation)
        );
        return operation;
    };
    let lastProgress = JSON.stringify(initialProgress);
    const progressTimer = setInterval(() => {
        void readUpdateProgress(dataRoot).then((update) => {
            const serialized = JSON.stringify(update);
            if (serialized === lastProgress || socket.readyState !== WebSocket.OPEN) {
                return;
            }
            lastProgress = serialized;
            socket.send(JSON.stringify({ type: 'update-progress', update }));
        });
    }, 500);
    socket.addEventListener('close', () => {
        clearInterval(progressTimer);
    });
    await new Promise<void>((resolve, reject) => {
        socket.addEventListener('error', () => {
            reject(new Error('Computer attachment socket failed.'));
        });
        socket.addEventListener('message', (event) => {
            const frame = JSON.parse(String(event.data)) as { type?: string };
            if (parseServerDeleteCommand(frame)) {
                deleting = true;
                socket.close();
                for (const controller of running.values()) {
                    controller.abort();
                }
                void purgeServerPartition(dataRoot, attachment.serverId, pendingWriters).catch(
                    (error) => {
                        console.error(error instanceof Error ? error.message : error);
                    }
                );
                return;
            }
            if (deleting) {
                return;
            }
            const bootstrap = parseBootstrapAccepted(frame);
            if (bootstrap) {
                if (bootstrap.mode === 'ordinary') {
                    void trackWriter(
                        sendComputerReport(socket, attachment.serverId).catch(reportStateError)
                    ).finally(() => {
                        if (process.env.GROTTO_COMPUTER_ONESHOT === '1') {
                            socket.close();
                        }
                        resolve();
                    });
                    return;
                }
                if (process.env.GROTTO_COMPUTER_ONESHOT === '1') {
                    socket.close();
                }
                resolve();
                return;
            }
            const update = parseComputerUpdateCommand(frame);
            if (update) {
                void runSignedUpdate({
                    dataRoot,
                    release: update.release,
                    restart: restartAfterUpdate,
                }).catch((error) => {
                    console.error(error instanceof Error ? error.message : error);
                });
                return;
            }
            const stop = parseStopCommand(frame);
            if (stop) {
                running.get(stop.runId)?.abort();
                return;
            }
            const configuration = parseAgentConfigureCommand(frame);
            if (configuration) {
                void trackWriter(
                    waitForAgentRunToSettle(agentRuns, configuration.agentId)
                        .then(() =>
                            applyAgentConfiguration({
                                command: configuration,
                                dataRoot,
                                inventory: detectInventory(),
                                serverId: attachment.serverId,
                            })
                        )
                        .then(() => sendComputerReport(socket, attachment.serverId))
                        .catch(reportStateError)
                );
                return;
            }
            const skillImport = parseAgentSkillImportCommand(frame);
            if (skillImport) {
                void trackWriter(
                    waitForAgentRunToSettle(agentRuns, skillImport.agentId)
                        .then(() =>
                            importHostSkill({
                                agentId: skillImport.agentId,
                                dataRoot,
                                serverId: attachment.serverId,
                                sourceId: skillImport.sourceId,
                            })
                        )
                        .then(async (skill) => {
                            socket.send(
                                JSON.stringify({
                                    agentId: skillImport.agentId,
                                    requestId: skillImport.requestId,
                                    skill,
                                    type: 'agent-skill-import-result',
                                })
                            );
                            await sendComputerReport(socket, attachment.serverId);
                        })
                        .catch((error) => {
                            socket.send(
                                JSON.stringify({
                                    agentId: skillImport.agentId,
                                    error: safeSkillImportError(error),
                                    requestId: skillImport.requestId,
                                    type: 'agent-skill-import-result',
                                })
                            );
                        })
                );
                return;
            }
            const workspaceRequest = parseAgentWorkspaceRequest(frame);
            if (workspaceRequest) {
                void trackWriter(
                    runAgentWorkspaceRequest({
                        dataRoot,
                        request: workspaceRequest,
                        serverId: attachment.serverId,
                    }).then((result) => socket.send(JSON.stringify(result)))
                );
                return;
            }
            const reset = parseResetCommand(frame);
            if (reset) {
                resettingAgents.add(reset.agentId);
                const runId = agentRuns.get(reset.agentId);
                if (runId) {
                    running.get(runId)?.abort();
                }
                void trackWriter(
                    waitForAgentRunToSettle(agentRuns, reset.agentId)
                        .then(() =>
                            resetAgentState({
                                agentId: reset.agentId,
                                dataRoot,
                                kind: reset.kind,
                                serverId: attachment.serverId,
                            })
                        )
                        .then(() => sendComputerReport(socket, attachment.serverId))
                        .catch((error) => {
                            console.error(error instanceof Error ? error.message : error);
                        })
                        .finally(() => {
                            resettingAgents.delete(reset.agentId);
                        })
                );
                return;
            }
            const reminderScript = parseReminderScriptCommand(frame);
            if (reminderScript) {
                void trackWriter(
                    waitForAgentRunToSettle(agentRuns, reminderScript.agentId)
                        .then(() =>
                            runReminderScript({
                                command: reminderScript,
                                dataRoot,
                                serverId: attachment.serverId,
                            })
                        )
                        .then((result) => socket.send(JSON.stringify(result)))
                        .catch((error) => {
                            console.error(error instanceof Error ? error.message : error);
                        })
                );
                return;
            }
            const notice = parseNoticeCommand(frame);
            if (notice) {
                void trackWriter(
                    writePendingNotice(dataRoot, {
                        agentId: notice.agentId,
                        pending: notice.pending,
                        serverId: attachment.serverId,
                    })
                        .then(async () => {
                            const sink = noticeSinks.get(notice.agentId);
                            if (sink?.runId === notice.runId) {
                                await sink.deliver(notice.pending);
                            }
                        })
                        .catch((error) => {
                            console.error(error instanceof Error ? error.message : error);
                        })
                );
                return;
            }
            const command = parseStartCommand(frame);
            if (command) {
                if (resettingAgents.has(command.agentId)) {
                    return;
                }
                // Reserve the run synchronously, before any async marker I/O, so a
                // duplicate start frame that arrives mid-launch is deduped here
                // instead of racing into a second concurrent child.
                const reservation = reserveAgentRun(
                    running,
                    agentRuns,
                    command.agentId,
                    command.runId
                );
                if (reservation.kind === 'duplicate') {
                    socket.send(
                        JSON.stringify({
                            agentId: command.agentId,
                            runId: command.runId,
                            type: 'ack',
                        })
                    );
                    return;
                }
                if (reservation.kind === 'busy') {
                    return;
                }
                void trackWriter(
                    admitActiveRun(dataRoot, command.runId)
                        .then((clearActiveRun) => {
                            if (!clearActiveRun) {
                                releaseAgentRun(running, agentRuns, command.agentId, command.runId);
                                return;
                            }
                            return handleStartCommand({
                                agentRuns,
                                attachment,
                                clearActiveRun,
                                command,
                                controller: reservation.controller,
                                noticeSinks,
                                running,
                                socket,
                            });
                        })
                        .catch((error) => {
                            releaseAgentRun(running, agentRuns, command.agentId, command.runId);
                            console.error(error instanceof Error ? error.message : error);
                        })
                );
            }
        });
        socket.addEventListener('open', () => {
            void readUpdateProgress(dataRoot).then((update) => {
                lastProgress = JSON.stringify(update);
                socket.send(
                    JSON.stringify({
                        architecture: arch(),
                        bootstrapProtocolVersion: computerBootstrapProtocolVersion,
                        credential: attachment.credential,
                        health: 'healthy',
                        operatingSystem: platform(),
                        productVersion: computerVersion,
                        protocolVersion: computerProtocolVersion,
                        type: 'bootstrap',
                        update,
                    })
                );
            });
        });
    });
}

function safeSkillImportError(error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (
        message === 'That host skill is no longer available.' ||
        message === 'The imported skill could not be verified.' ||
        /^The Agent already has a skill named "[A-Za-z0-9_-]{1,128}"\.$/u.test(message)
    ) {
        return message;
    }
    return 'The skill could not be imported.';
}

async function waitForAgentRunToSettle(
    agentRuns: Map<string, string>,
    agentId: string
): Promise<void> {
    while (agentRuns.has(agentId)) {
        await Bun.sleep(10);
    }
}

/**
 * Handles one start command idempotently. The run is already reserved in
 * `running` (synchronously, by the caller), so only one launch per run can exist.
 * Local acceptance (the durable marker plus the ack) is recorded before any model
 * work, so a dropped ack or a Computer restart resolves against the marker: a
 * settled run replays its summary and only a genuinely fresh run launches.
 */
async function handleStartCommand(input: {
    agentRuns: Map<string, string>;
    attachment: Attachment;
    command: HostedAgentStartCommand;
    controller: AbortController;
    clearActiveRun: () => Promise<void>;
    noticeSinks: Map<string, { deliver: (pending: number) => Promise<boolean>; runId: string }>;
    running: Map<string, AbortController>;
    socket: WebSocket;
}): Promise<void> {
    const {
        agentRuns,
        attachment,
        clearActiveRun,
        command,
        controller,
        noticeSinks,
        running,
        socket,
    } = input;
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

        let summary: HostedAgentTurnFrame;
        try {
            summary = await runAgentLaunch({
                attachment,
                command,
                dataRoot,
                onRuntimeReady: async () => {
                    await writeRunMarker(dataRoot, {
                        marker: { status: 'accepted' },
                        runId: command.runId,
                        serverId: attachment.serverId,
                    });
                    ack();
                },
                registerNoticeSink: (deliver) => {
                    const sink = { deliver, runId: command.runId };
                    noticeSinks.set(command.agentId, sink);
                    return () => {
                        if (noticeSinks.get(command.agentId) === sink) {
                            noticeSinks.delete(command.agentId);
                        }
                    };
                },
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
        await sendComputerReport(socket, attachment.serverId).catch(reportStateError);
    } finally {
        await clearActiveRun();
        releaseAgentRun(running, agentRuns, command.agentId, command.runId);
    }
}

async function sendComputerReport(socket: WebSocket, serverId: string) {
    socket.send(
        JSON.stringify({
            agents: await readEffectiveAgentStates(dataRoot, serverId),
            inventory: {
                ...detectInventory(),
                agentSkills: await listAgentSkillReports(dataRoot, serverId),
                importableSkills: await listImportableSkills(),
            },
            type: 'report',
        })
    );
}

function reportStateError(error: unknown) {
    console.error(
        `Computer state report failed: ${error instanceof Error ? error.message : error}`
    );
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

function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

if (import.meta.main) {
    try {
        await main(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
