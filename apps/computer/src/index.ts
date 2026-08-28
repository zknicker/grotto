#!/usr/bin/env bun
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { arch, homedir, platform, userInfo } from 'node:os';
import { join } from 'node:path';
import type { AgentSkillImportCommand, AgentSkillImportRecord } from '@grotto/api';
import { runAgentCli } from './agent-cli.ts';
import {
    applyAgentConfiguration,
    applyCoveConfiguration,
    parseAgentConfigureCommand,
    parseCoveApplyCommand,
} from './agent-configuration.ts';
import { AgentConfigurationQueue } from './agent-configuration-queue.ts';
import { disposeAgentLaunchHost, disposeServerLaunchHosts } from './agent-launch-host.ts';
import { parseAgentRetireCommand, purgeRetiredAgent } from './agent-retirement.ts';
import { AgentRunSettlements } from './agent-run-settlements.ts';
import { applyAuthoritativeSession } from './agent-session-authority.ts';
import { parseAgentSkillFileRequest, runAgentSkillFileRequest } from './agent-skill-files.ts';
import {
    type AttachmentConnectionEvent,
    recordAttachmentConnectionEvent,
} from './attachment-connection-history.ts';
import { type AttachmentHeartbeat, startAttachmentHeartbeat } from './attachment-heartbeat.ts';
import {
    archiveUnlinkedAttachment,
    clearTerminalUnlinked,
    computerMachineUnlinkedExitCode,
    isTerminalUnlinked,
    markTerminalUnlinked,
} from './attachment-recovery.ts';
import {
    getOrCreatePendingAttachment,
    readPendingAttachment,
    removePendingAttachment,
} from './attachment-state.ts';
import { parseBrowserRequest, runBrowserRequest } from './browser/requests.ts';
import { reconcileComputerBrowser } from './browser/settings.ts';
import {
    computerAttachmentDaemonEntrypoint,
    computerEntrypoint,
    computerSourceRevision,
    computerVersion,
} from './build-identity.ts';
import { printComputerHeader, printComputerHelpPage } from './cli/chrome.ts';
import { findComputerCommandHelp, resolveComputerHelpRequest } from './cli/help.ts';
import { cliColorsEnabled, createCliRenderer, stdoutRenderer } from './cli/render.ts';
import { readComputerName } from './computer-name.ts';
import {
    decideStart,
    purgeServerPartition,
    readRunMarker,
    releaseAgentRun,
    reserveAgentRun,
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
    parseExecutionJournalRequest,
    readExecutionJournalRequest,
} from './execution-journal-relay.ts';
import { validateComputerBridgeAssets } from './harness/bridge-bootstrap.ts';
import { prewarmBridgeStores } from './harness/bridge-prewarm.ts';
import { requestSessionRestart } from './harness/session-restart.ts';
import {
    acceptHostSkillImport,
    finishHostSkillImport,
    importHostSkill,
    listAcceptedHostSkillImports,
    listAgentSkillImportReports,
    listAgentSkillReports,
    listImportableSkills,
    parseAgentSkillImportCommand,
} from './host-skills.ts';
import {
    acceptRunInbox,
    clearRunVisibleMessages,
    prepareRunReplay,
    reofferPendingMessages,
    replacePendingInbox,
} from './inbox-store.ts';
import { detectInventory } from './inventory.ts';
import {
    type AgentStartCommand,
    type AgentTurnFrame,
    type Attachment,
    parseNoticeCommand,
    parseResetCommand,
    parseRestartCommand,
    parseServerDeleteCommand,
    parseStartCommand,
    parseStopCommand,
    resetAgentState,
    runAgentLaunch,
} from './launch.ts';
import { replaceLaunchdService } from './launchd.ts';
import {
    completeComputerLogin,
    ensureComputerLoginSession,
    readComputerLoginSession,
    resolveComputerLogin,
    revokeComputerLoginSession,
    runComputerLogin,
} from './login.ts';
import { parseReminderScriptCommand, runReminderScript } from './reminder-script.ts';
import { runtimeSearchPath } from './runtime-discovery.ts';
import {
    admitActiveRun,
    isNewerVersion,
    progress,
    readProductionRelease,
    readUpdateProgress,
    rollbackComputer,
    runSignedUpdate,
    writeUpdateProgress,
} from './update.ts';
import {
    type ComputerUpdateProgress,
    computerBootstrapProtocolVersion,
    computerProtocolVersion,
    parseBootstrapAccepted,
    parseComputerHeartbeatAck,
    parseComputerHeartbeatConfiguration,
    parseComputerUpdateCommand,
} from './update-contract.ts';
import { createUpgradeRenderer, describeConcurrentUpdate } from './upgrade-render.ts';
import { createComputerUsageCache } from './usage/computer-usage-cache.ts';
import {
    readOpenRouterManagementKey,
    saveOpenRouterManagementKey,
} from './usage/openrouter-settings.ts';
import { parseAgentWorkspaceRequest, runAgentWorkspaceRequest } from './workspace-files.ts';

interface AttachResponse {
    computerId: string;
    idempotent: boolean;
    serverId: string;
    slug: string;
}

const dataRoot = process.env.GROTTO_COMPUTER_DATA_ROOT ?? join(homedir(), '.grotto', 'computer');
const readCachedComputerUsage = createComputerUsageCache({ dataRoot });
const serverOrigin = process.env.GROTTO_SERVER_ORIGIN ?? 'https://grotto.sh';

// Commands that open with the one-line header on a TTY. The freshness status
// line rides along only where staleness is the point of the command.
const headerCommands: Record<string, { updateStatus: boolean }> = {
    attach: { updateStatus: false },
    'configure-openrouter': { updateStatus: false },
    doctor: { updateStatus: true },
    install: { updateStatus: false },
    login: { updateStatus: false },
    logout: { updateStatus: false },
    logs: { updateStatus: false },
    restart: { updateStatus: false },
    setup: { updateStatus: false },
    start: { updateStatus: false },
    status: { updateStatus: true },
    stop: { updateStatus: false },
    upgrade: { updateStatus: false },
};

async function main(args: string[]) {
    const [command, target] = args;
    // The embedded Agent CLI. The managed `grotto` wrapper re-executes this
    // entrypoint; it is a separate command surface, not a separate artifact.
    if (command === '__agent') {
        process.exitCode = await runAgentCli(args.slice(1));
        return;
    }
    if (command === '__release-check') {
        await validateComputerBridgeAssets();
        console.log('Grotto Computer release assets are ready.');
        return;
    }
    const helpRequest = resolveComputerHelpRequest(args);
    if (helpRequest) {
        await printComputerHelpPage(helpRequest, { dataRoot });
        return;
    }
    const headerPrinted =
        command !== undefined && command in headerCommands
            ? await printComputerHeader({
                  dataRoot,
                  updateStatus: headerCommands[command]?.updateStatus === true,
              })
            : false;
    if (command === 'install') {
        await installResidentService();
        console.log(stdoutRenderer.ok('Grotto Computer resident service installed.'));
        return;
    }
    if (command === 'upgrade') {
        if (target === '--rollback') {
            await rollbackComputer({
                onPhase: (phase) => {
                    console.log(
                        phase === 'restoring'
                            ? 'Restoring the previous verified Grotto Computer executable…'
                            : 'Restarting Grotto Computer…'
                    );
                },
                restart: restartAfterUpdate,
            });
            console.log(
                stdoutRenderer.ok('Grotto Computer restored the previous verified executable.')
            );
            return;
        }
        console.log('Checking for the latest Grotto Computer release…');
        const release = await readProductionRelease();
        if (!isNewerVersion(release.release.version, computerVersion)) {
            console.log(
                stdoutRenderer.ok(
                    `Grotto Computer ${computerVersion} is already the latest release.`
                )
            );
            return;
        }
        const renderer = createUpgradeRenderer({
            isTTY: process.stdout.isTTY === true,
            write: (text) => process.stdout.write(text),
        });
        const outcome = await runSignedUpdate({
            dataRoot,
            onProgress: (update) => renderer.observe(update),
            release,
            restart: restartAfterUpdate,
        });
        renderer.finish();
        if (outcome.status === 'already-running') {
            console.log(stdoutRenderer.warn(describeConcurrentUpdate(outcome.progress)));
            return;
        }
        console.log(
            stdoutRenderer.ok(
                `Grotto Computer ${outcome.version} is installed. The Computer service is restarting.`
            )
        );
        return;
    }
    if (command === '--version' || command === 'version') {
        // Piped output is a contract: the signed-release updater JSON-parses
        // this to verify artifact identity. Only a TTY gets the pretty line.
        if (process.stdout.isTTY === true) {
            console.log(
                `${stdoutRenderer.header({ version: computerVersion })} ${stdoutRenderer.hint(
                    `protocol ${computerProtocolVersion} · revision ${computerSourceRevision}`
                )}`
            );
            return;
        }
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
        console.log(formatComputerStatus(await readComputerStatus(dataRoot), stdoutRenderer));
        return;
    }
    if (command === 'doctor') {
        const result = await doctorComputer(dataRoot, validate);
        console.log(formatDoctor(result, stdoutRenderer));
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
    if (command === 'configure-openrouter') {
        await saveOpenRouterManagementKey(dataRoot, await Bun.stdin.text());
        console.log(
            stdoutRenderer.ok('OpenRouter account usage is configured on this Grotto Computer.')
        );
        return;
    }
    if (command === 'login') {
        await runComputerLogin({
            dataRoot,
            replace: target === '--replace',
            serverOrigin,
        });
        return;
    }
    if (command === 'logout') {
        const session = await readComputerLoginSession(dataRoot);
        let revocationFailure: unknown;
        try {
            if (session) {
                await revokeComputerLoginSession(session);
            }
        } catch (cause) {
            revocationFailure = cause;
        }
        await rm(join(dataRoot, 'login.json'), { force: true });
        await stopComputerService();
        if (revocationFailure) {
            const detail =
                revocationFailure instanceof Error
                    ? revocationFailure.message
                    : String(revocationFailure);
            throw new Error(
                `Grotto Computer logged out locally, but Server-side revocation failed: ${detail}`
            );
        }
        console.log(stdoutRenderer.ok('Grotto Computer logged out.'));
        return;
    }
    if (command === 'start') {
        await recoverInterruptedUpdate();
        await finishRestart();
        await rm(stoppedPath(), { force: true });
        if (target && (await reportUnlinkedAttachment(await requiredAttachment(target)))) {
            return;
        }
        await startAttachments(target);
        if (process.env.GROTTO_COMPUTER_RESIDENT === '1') {
            for (;;) {
                await Bun.sleep(500);
                await startAttachments(target);
            }
        }
        console.log(stdoutRenderer.ok(target ? `Started ${target}.` : 'Grotto Computer started.'));
        return;
    }
    if (command === 'stop') {
        if (target) {
            await stopAttachmentDaemon(await requiredAttachment(target));
            console.log(stdoutRenderer.ok(`Stopped ${target}.`));
            return;
        }
        await stopComputerService();
        console.log(stdoutRenderer.ok('Grotto Computer stopped.'));
        return;
    }
    if (command === 'restart') {
        if (!target) {
            await printIncompleteCommand('restart', headerPrinted);
            return;
        }
        const attachment = await requiredAttachment(target);
        if (await reportUnlinkedAttachment(attachment)) {
            return;
        }
        await stopAttachmentDaemon(attachment);
        await startAttachmentDaemon(attachment);
        console.log(stdoutRenderer.ok(`Restarted /${attachment.slug}.`));
        return;
    }
    if (command === '__attachment-daemon') {
        const attachment = await readAttachment(target);
        if (!attachment) {
            throw new Error('This Server is not attached to this Grotto Computer.');
        }
        try {
            await validate(attachment);
        } catch (error) {
            if (!isComputerMachineUnlinked(error)) {
                throw error;
            }
            await markTerminalUnlinked(dataRoot, attachment);
            process.exitCode = computerMachineUnlinkedExitCode;
            return;
        }
        // Fire-and-forget: a warm store makes first Agent bootstraps local
        // hard-links; a failed warm just means they fetch, as before. Tests
        // exercise this daemon path and must not spawn real installs.
        if (process.env.NODE_ENV !== 'test') {
            void prewarmBridgeStores({
                agentsRoot: join(dataRoot, 'servers', attachment.serverId, 'agents'),
            });
        }
        await connect(attachment);
        return;
    }
    if (command === 'attach') {
        if (!target?.startsWith('/')) {
            await printIncompleteCommand('attach', headerPrinted);
            return;
        }
        await attachServer(serverSlugFromTarget(target));
        return;
    }
    if (command !== 'setup') {
        await printComputerHelpPage(
            { error: `Unknown command "${command}".`, kind: 'global' },
            { dataRoot }
        );
        return;
    }
    if (!target?.startsWith('/')) {
        await printIncompleteCommand('setup', headerPrinted);
        return;
    }
    const slug = serverSlugFromTarget(target);
    const current = await findAttachment(slug);
    if (current) {
        try {
            await validate(current);
            await clearTerminalUnlinked(dataRoot, current);
            const pending = await readPendingAttachment(dataRoot, slug);
            if (pending) {
                const session = await readComputerLoginSession(dataRoot);
                if (session?.origin === pending.origin) {
                    await completeComputerLogin(
                        await ensureComputerLoginSession({ dataRoot, session })
                    );
                }
            }
            await removePendingAttachment(dataRoot, slug);
            await startAttachmentDaemon(current);
            console.log(stdoutRenderer.ok(`Grotto Computer resumed /${slug}.`));
            return;
        } catch (error) {
            if (!isComputerMachineUnlinked(error)) {
                throw error;
            }
        }
    }
    await setupServer(slug, current);
}

/**
 * A terminally unlinked attachment never starts its daemon, so start/restart
 * must report the setup path instead of claiming success.
 */
async function reportUnlinkedAttachment(attachment: Attachment): Promise<boolean> {
    if (!(await isTerminalUnlinked(dataRoot, attachment))) {
        return false;
    }
    console.log(
        stdoutRenderer.fail(
            `/${attachment.slug} needs setup — run grotto-computer setup /${attachment.slug}.`
        )
    );
    process.exitCode = 1;
    return true;
}

async function printIncompleteCommand(name: string, omitHeader: boolean) {
    const command = findComputerCommandHelp(name);
    if (!command) {
        throw new Error(`Unknown command "${name}".`);
    }
    await printComputerHelpPage(
        { command, error: `${name} needs a Server address such as /hq.`, kind: 'command' },
        { dataRoot, omitHeader }
    );
}

function serverSlugFromTarget(target: string) {
    const slug = target.slice(1);
    if (slug.length < 2 || slug.length > 32 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(slug)) {
        throw new Error('A Server address uses 2–32 lowercase letters, numbers, and hyphens.');
    }
    return slug;
}

async function attachServer(slug: string) {
    const session = await resolveComputerLogin({
        allowLogin: false,
        dataRoot,
        serverOrigin,
    });
    const current = await findAttachment(slug);
    if (current) {
        await validate(current);
        await clearTerminalUnlinked(dataRoot, current);
        await removePendingAttachment(dataRoot, slug);
        await startAttachmentDaemon(current);
        console.log(stdoutRenderer.ok(`Grotto Computer resumed /${slug}.`));
        return;
    }
    const issued = await issueAttachment(slug, session);
    await writeAttachment(issued.attachment);
    await removePendingAttachment(dataRoot, slug);
    await startAttachmentDaemon(issued.attachment);
    console.log(stdoutRenderer.ok(`Grotto Computer attached to /${slug}.`));
}

async function setupServer(slug: string, current: Attachment | null) {
    let session = await resolveComputerLogin({
        allowLogin: true,
        complete: false,
        dataRoot,
        purpose: 'setup',
        serverOrigin,
    });

    let issued: Awaited<ReturnType<typeof issueAttachment>>;
    try {
        issued = await issueAttachment(slug, session);
    } catch (cause) {
        if (!isComputerLoginRequestFailure(cause)) {
            throw cause;
        }
        session = await runComputerLogin({
            complete: false,
            dataRoot,
            purpose: 'setup',
            replace: true,
            serverOrigin,
        });
        issued = await issueAttachment(slug, session);
    }

    if (current) {
        await stopAttachmentDaemon(current);
        const archivedPath = await archiveUnlinkedAttachment(dataRoot, current);
        console.log(`Archived the stale Computer attachment at ${archivedPath}.`);
    }
    await writeAttachment(issued.attachment);
    await completeComputerLogin(session);
    await removePendingAttachment(dataRoot, slug);
    await startAttachmentDaemon(issued.attachment);
    console.log(stdoutRenderer.ok(`Grotto Computer attached to /${slug}.`));
}

async function issueAttachment(
    slug: string,
    session: Awaited<ReturnType<typeof resolveComputerLogin>>
) {
    const pending = await getOrCreatePendingAttachment({
        dataRoot,
        origin: session.origin,
        slug,
    });
    const response = await request<AttachResponse>(
        '/computer/attach',
        {
            accessToken: session.accessToken,
            credentialHash: hash(pending.credential),
            idempotencyKey: pending.idempotencyKey,
            slug,
        },
        session.origin
    );
    if (
        typeof response.computerId !== 'string' ||
        typeof response.serverId !== 'string' ||
        response.slug !== slug ||
        typeof response.idempotent !== 'boolean'
    ) {
        throw new Error('Server returned an invalid Computer attachment.');
    }
    return {
        attachment: {
            computerId: response.computerId,
            credential: pending.credential,
            serverId: response.serverId,
            serverOrigin: session.origin,
            slug,
        } satisfies Attachment,
        pending,
    };
}

function isComputerLoginRequestFailure(cause: unknown) {
    return (
        cause instanceof ComputerRequestError &&
        (cause.status === 401 || cause.code?.startsWith('computer_login_') === true)
    );
}

async function startAttachments(target: string | undefined) {
    if (await isStopped()) {
        return;
    }
    if (target) {
        await startAttachmentDaemon(await requiredAttachment(target));
        return;
    }
    await Promise.all((await listAttachments()).map(startAttachmentDaemon));
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

async function request<Response>(
    path: string,
    body: object,
    origin = serverOrigin
): Promise<Response> {
    const response = await fetch(new URL(path, origin), {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        redirect: 'error',
    });
    let payload: Response & { code?: string; error?: string };
    try {
        payload = (await response.json()) as Response & { code?: string; error?: string };
    } catch {
        payload = {} as Response & { code?: string; error?: string };
    }
    if (!response.ok) {
        throw new ComputerRequestError(
            payload.error ?? 'Computer request was rejected.',
            payload.code,
            response.status
        );
    }
    return payload;
}

class ComputerRequestError extends Error {
    constructor(
        message: string,
        readonly code: string | undefined,
        readonly status: number
    ) {
        super(message);
        this.name = 'ComputerRequestError';
    }
}

function isComputerMachineUnlinked(error: unknown): boolean {
    return (
        error instanceof ComputerRequestError &&
        error.status === 403 &&
        error.code === 'computer_machine_unlinked'
    );
}

async function writeAttachment(attachment: Attachment) {
    const directory = join(dataRoot, 'servers', attachment.serverId);
    await mkdir(directory, { mode: 0o700, recursive: true });
    const destination = join(directory, 'attachment.json');
    const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
    try {
        await writeFile(temporary, `${JSON.stringify(attachment)}\n`, { mode: 0o600 });
        await rename(temporary, destination);
    } finally {
        await rm(temporary, { force: true });
    }
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

async function stopComputerService() {
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    await writeFile(stoppedPath(), '', { mode: 0o600 });
    await Promise.all((await listAttachments()).map(stopAttachmentDaemon));
    await stopResidentService();
}

async function startAttachmentDaemon(attachment: Attachment) {
    if (await isTerminalUnlinked(dataRoot, attachment)) {
        return;
    }
    const marker = await readAttachmentDaemonMarker(attachment);
    if (marker && isPidAlive(marker.pid) && marker.credentialHash === hash(attachment.credential)) {
        return;
    }
    if (marker && isPidAlive(marker.pid)) {
        process.kill(marker.pid, 'SIGTERM');
    }
    const entrypoint = computerAttachmentDaemonEntrypoint(attachment.serverId, {
        watch: process.env.GROTTO_COMPUTER_WATCH_ATTACHMENT_DAEMON === '1',
    });
    const child = Bun.spawn([entrypoint.executable, ...entrypoint.args], {
        env: {
            ...process.env,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ATTACHMENT_DAEMON: '1',
        },
        stderr: 'inherit',
        stdin: 'ignore',
        stdout: 'inherit',
    });
    await writeFile(
        attachmentDaemonPath(attachment),
        `${JSON.stringify({ credentialHash: hash(attachment.credential), pid: child.pid })}\n`,
        { mode: 0o600 }
    );
    // The durable marker and resident supervisor own the attachment daemon, not this
    // one-shot CLI invocation.
    child.unref();
    void child.exited.then(async () => {
        const marker = await readAttachmentDaemonMarker(attachment);
        if (marker?.pid === child.pid) {
            await rm(attachmentDaemonPath(attachment), { force: true });
        }
    });
}

async function stopAttachmentDaemon(attachment: Attachment) {
    const marker = await readAttachmentDaemonMarker(attachment);
    try {
        if (marker && isPidAlive(marker.pid)) {
            process.kill(marker.pid, 'SIGTERM');
        }
    } catch {
        // A stopped or stale attachment daemon is already isolated from the other attachments.
    }
    await rm(attachmentDaemonPath(attachment), { force: true });
}

function attachmentDaemonPath(attachment: Attachment) {
    return join(dataRoot, 'servers', attachment.serverId, 'attachment-daemon.pid');
}

async function readAttachmentDaemonMarker(
    attachment: Attachment
): Promise<{ credentialHash: string | null; pid: number } | null> {
    try {
        const contents = await readFile(attachmentDaemonPath(attachment), 'utf8');
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
    replaceLaunchdService({
        domain,
        label: 'com.grotto.computer',
        plistPath,
        run: (args) =>
            Bun.spawnSync(['/bin/launchctl', ...args], {
                stderr: 'ignore',
                stdout: 'ignore',
            }).exitCode,
    });
}

async function stopResidentService() {
    if (platform() !== 'darwin') {
        return;
    }
    const plistPath = join(homedir(), 'Library', 'LaunchAgents', 'com.grotto.computer.plist');
    if (!(await stat(plistPath).catch(() => null))) {
        return;
    }
    const result = Bun.spawnSync(['/bin/launchctl', 'bootout', `gui/${userInfo().uid}`, plistPath]);
    if (result.exitCode !== 0 && result.exitCode !== 3) {
        throw new Error('Could not stop Grotto Computer service.');
    }
}

async function restartAfterUpdate() {
    for (const attachment of await listAttachments()) {
        try {
            const marker = await readAttachmentDaemonMarker(attachment);
            if (marker && marker.pid !== process.pid && isPidAlive(marker.pid)) {
                process.kill(marker.pid, 'SIGTERM');
            }
        } catch {
            // A missing attachment daemon is already ready for the resident restart.
        }
        await rm(attachmentDaemonPath(attachment), { force: true });
    }
    await installResidentService();
    if (process.env.GROTTO_COMPUTER_ATTACHMENT_DAEMON === '1') {
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
    const path = escapeXml(runtimeSearchPath());
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.grotto.computer</string><key>ProgramArguments</key><array>${programArguments}</array><key>EnvironmentVariables</key><dict><key>GROTTO_COMPUTER_DATA_ROOT</key><string>${escaped.at(-1)}</string><key>GROTTO_COMPUTER_RESIDENT</key><string>1</string><key>PATH</key><string>${path}</string></dict><key>StandardOutPath</key><string>${logPath}</string><key>StandardErrorPath</key><string>${logPath}</string><key>KeepAlive</key><true/><key>RunAtLoad</key><true/></dict></plist>\n`;
}

function escapeXml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

async function connect(attachment: Attachment) {
    const browserRoot = join(dataRoot, 'servers', attachment.serverId, 'browser');
    void reconcileComputerBrowser(browserRoot).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
    });
    const socketUrl = new URL('/computer/attachment', attachment.serverOrigin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const [initialProgress, computerName] = await Promise.all([
        readUpdateProgress(dataRoot),
        readComputerName(),
    ]);
    const socket = new WebSocket(socketUrl);
    // Live runs in this process, keyed by run so a Stop can kill the right child.
    const running = new Map<string, AbortController>();
    const agentRuns = new Map<string, string>();
    const noticeSinks = new Map<
        string,
        { deliver: (notice: string) => Promise<boolean>; runId: string }
    >();
    const resettingAgents = new Set<string>();
    const retiredAgents = new Set<string>();
    const agentConfigurations = new AgentConfigurationQueue();
    const runSettlements = new AgentRunSettlements(agentRuns);
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
    const startAgent = (command: AgentStartCommand) => {
        if (resettingAgents.has(command.agentId) || retiredAgents.has(command.agentId)) {
            return;
        }
        // Reserve the run synchronously, before any async marker I/O, so a
        // duplicate start frame that arrives mid-launch is deduped here
        // instead of racing into a second concurrent child.
        const reservation = reserveAgentRun(running, agentRuns, command.agentId, command.runId);
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
        const releaseRun = () => {
            releaseAgentRun(running, agentRuns, command.agentId, command.runId);
            runSettlements.released(command.agentId);
        };
        void trackWriter(
            admitActiveRun(dataRoot, command.runId)
                .then((clearActiveRun) => {
                    if (!clearActiveRun) {
                        releaseRun();
                        return;
                    }
                    return handleStartCommand({
                        attachment,
                        clearActiveRun,
                        command,
                        computerName,
                        controller: reservation.controller,
                        noticeSinks,
                        releaseRun,
                        socket,
                    });
                })
                .catch((error) => {
                    releaseRun();
                    console.error(error instanceof Error ? error.message : error);
                })
        );
    };
    const sendSkillImportRecord = (record: AgentSkillImportRecord) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ ...record, type: 'agent-skill-import-result' }));
        }
    };
    const applyAcceptedSkillImport = async (
        record: Extract<AgentSkillImportRecord, { status: 'accepted' }>
    ) => {
        let settled: AgentSkillImportRecord;
        try {
            await runSettlements.wait(record.agentId);
            const skill = await importHostSkill({
                agentId: record.agentId,
                dataRoot,
                serverId: attachment.serverId,
                sourceId: record.sourceId,
            });
            settled = await finishHostSkillImport({
                dataRoot,
                record: {
                    agentId: record.agentId,
                    requestId: record.requestId,
                    skill,
                    sourceId: record.sourceId,
                    status: 'applied',
                },
                serverId: attachment.serverId,
            });
        } catch (error) {
            settled = await finishHostSkillImport({
                dataRoot,
                record: {
                    agentId: record.agentId,
                    error: safeSkillImportError(error),
                    requestId: record.requestId,
                    sourceId: record.sourceId,
                    status: 'failed',
                },
                serverId: attachment.serverId,
            });
        }
        sendSkillImportRecord(settled);
        await sendComputerReport(socket, attachment.serverId, computerName);
    };
    const acceptSkillImport = async (command: AgentSkillImportCommand) => {
        const record = await acceptHostSkillImport({
            command,
            dataRoot,
            serverId: attachment.serverId,
        });
        sendSkillImportRecord(record);
        await sendComputerReport(socket, attachment.serverId, computerName);
        if (record.status === 'accepted') {
            await applyAcceptedSkillImport(record);
        }
    };
    let lastProgress = JSON.stringify(initialProgress);
    let heartbeat: AttachmentHeartbeat | null = null;
    let connected = false;
    let disconnectWrite: Promise<void> | null = null;
    let disconnectReason: Extract<AttachmentConnectionEvent, { kind: 'disconnected' }>['reason'] =
        'socket-close';
    let usageTimer: ReturnType<typeof setInterval> | null = null;
    const recordConnectionEvent = (event: AttachmentConnectionEvent) =>
        recordAttachmentConnectionEvent(dataRoot, attachment.serverId, event).catch((error) => {
            console.error(
                `Computer connection history failed: ${error instanceof Error ? error.message : error}`
            );
        });
    const recordDisconnect = () => {
        if (disconnectWrite) {
            return disconnectWrite;
        }
        disconnectWrite = recordConnectionEvent({
            at: new Date().toISOString(),
            kind: 'disconnected',
            reason: disconnectReason,
        });
        return disconnectWrite;
    };
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
    await new Promise<void>((resolve, reject) => {
        socket.addEventListener('close', () => {
            clearInterval(progressTimer);
            heartbeat?.dispose();
            if (usageTimer) {
                clearInterval(usageTimer);
            }
            void recordDisconnect().finally(resolve);
        });
        socket.addEventListener('error', () => {
            heartbeat?.dispose();
            disconnectReason = 'socket-error';
            void recordDisconnect().finally(() => {
                reject(new Error('Computer attachment socket failed.'));
            });
        });
        socket.addEventListener('message', (event) => {
            const frame = JSON.parse(String(event.data)) as { type?: string };
            const heartbeatConfiguration = parseComputerHeartbeatConfiguration(frame);
            if (heartbeatConfiguration) {
                heartbeat?.dispose();
                heartbeat = startAttachmentHeartbeat({
                    configuration: heartbeatConfiguration,
                    onTimeout: () => {
                        disconnectReason = 'heartbeat-timeout';
                    },
                    socket,
                });
                return;
            }
            const heartbeatAck = parseComputerHeartbeatAck(frame);
            if (heartbeatAck) {
                heartbeat?.acceptAck(heartbeatAck.id);
                return;
            }
            if (parseServerDeleteCommand(frame)) {
                deleting = true;
                disposeServerLaunchHosts(attachment.serverId);
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
                if (!connected) {
                    connected = true;
                    void recordConnectionEvent({
                        at: new Date().toISOString(),
                        kind: 'connected',
                    });
                }
                socket.send(JSON.stringify({ type: 'heartbeat-negotiate' }));
                if (bootstrap.mode === 'ordinary') {
                    const initialReport = sendComputerReport(
                        socket,
                        attachment.serverId,
                        computerName
                    ).then(async () => {
                        const acceptedImports = await listAcceptedHostSkillImports(
                            dataRoot,
                            attachment.serverId
                        );
                        for (const record of acceptedImports) {
                            await applyAcceptedSkillImport(record);
                        }
                        if (process.env.GROTTO_COMPUTER_USAGE_DISABLED !== '1') {
                            await sendUsageReport(socket);
                        }
                    });
                    void trackWriter(initialReport.catch(reportStateError)).finally(() => {
                        if (process.env.GROTTO_COMPUTER_ONESHOT === '1') {
                            socket.close();
                        }
                    });
                    if (process.env.GROTTO_COMPUTER_USAGE_DISABLED !== '1' && usageTimer === null) {
                        usageTimer = setInterval(() => {
                            void trackWriter(sendUsageReport(socket).catch(reportStateError));
                        }, 15 * 60_000);
                    }
                    return;
                }
                if (process.env.GROTTO_COMPUTER_ONESHOT === '1') {
                    socket.close();
                }
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
            const restart = parseRestartCommand(frame);
            if (restart) {
                if (retiredAgents.has(restart.agentId)) {
                    return;
                }
                void trackWriter(
                    agentConfigurations
                        .enqueue(restart.agentId, async () => {
                            await runSettlements.wait(restart.agentId);
                            disposeAgentLaunchHost(attachment.serverId, restart.agentId);
                            await requestSessionRestart(
                                join(
                                    dataRoot,
                                    'servers',
                                    attachment.serverId,
                                    'agents',
                                    restart.agentId
                                )
                            );
                        })
                        .catch(reportStateError)
                );
                return;
            }
            const retirement = parseAgentRetireCommand(frame);
            if (retirement) {
                retiredAgents.add(retirement.agentId);
                const runId = agentRuns.get(retirement.agentId);
                if (runId) {
                    running.get(runId)?.abort();
                }
                void trackWriter(
                    agentConfigurations
                        .wait(retirement.agentId)
                        .then(() => runSettlements.wait(retirement.agentId))
                        .then(() => {
                            disposeAgentLaunchHost(attachment.serverId, retirement.agentId);
                            return purgeRetiredAgent({
                                agentId: retirement.agentId,
                                dataRoot,
                                serverId: attachment.serverId,
                            });
                        })
                        .then(() => sendComputerReport(socket, attachment.serverId, computerName))
                        .catch(reportStateError)
                );
                return;
            }
            const configuration = parseAgentConfigureCommand(frame);
            if (configuration) {
                if (retiredAgents.has(configuration.agentId)) {
                    return;
                }
                void trackWriter(
                    agentConfigurations
                        .enqueue(configuration.agentId, async () => {
                            await runSettlements.wait(configuration.agentId);
                            const agentRoot = join(
                                dataRoot,
                                'servers',
                                attachment.serverId,
                                'agents',
                                configuration.agentId
                            );
                            await applyAuthoritativeSession({
                                agentRoot,
                                generation: configuration.sessionGeneration,
                                reset: async () => {
                                    disposeAgentLaunchHost(
                                        attachment.serverId,
                                        configuration.agentId
                                    );
                                    await resetAgentState({
                                        agentId: configuration.agentId,
                                        dataRoot,
                                        kind: configuration.sessionResetKind,
                                        serverId: attachment.serverId,
                                    });
                                },
                            });
                            await applyAgentConfiguration({
                                command: configuration,
                                dataRoot,
                                inventory: detectInventory(),
                                serverId: attachment.serverId,
                            });
                        })
                        .then(() => sendComputerReport(socket, attachment.serverId, computerName))
                        .catch(reportStateError)
                );
                return;
            }
            const coveApplication = parseCoveApplyCommand(frame);
            if (coveApplication) {
                if (retiredAgents.has(coveApplication.agentId)) {
                    return;
                }
                void trackWriter(
                    agentConfigurations
                        .enqueue(coveApplication.agentId, async () => {
                            await runSettlements.wait(coveApplication.agentId);
                            const result = await applyCoveConfiguration({
                                command: coveApplication,
                                dataRoot,
                                inventory: detectInventory(),
                                serverId: attachment.serverId,
                            });
                            socket.send(JSON.stringify(result));
                            if (result.status === 'applied') {
                                await sendComputerReport(socket, attachment.serverId, computerName);
                            }
                        })
                        .catch(reportStateError)
                );
                return;
            }
            const skillImport = parseAgentSkillImportCommand(frame);
            if (skillImport) {
                void trackWriter(acceptSkillImport(skillImport).catch(reportStateError));
                return;
            }
            const skillFileRequest = parseAgentSkillFileRequest(frame);
            if (skillFileRequest) {
                void trackWriter(
                    (skillFileRequest.operation.kind === 'read'
                        ? Promise.resolve()
                        : runSettlements.wait(skillFileRequest.agentId)
                    )
                        .then(() =>
                            runAgentSkillFileRequest({
                                dataRoot,
                                request: skillFileRequest,
                                serverId: attachment.serverId,
                            })
                        )
                        .then(async (result) => {
                            socket.send(JSON.stringify(result));
                            if (skillFileRequest.operation.kind !== 'read' && result.result) {
                                await sendComputerReport(socket, attachment.serverId, computerName);
                            }
                        })
                        .catch(reportStateError)
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
            const executionJournalRequest = parseExecutionJournalRequest(frame);
            if (executionJournalRequest) {
                void trackWriter(
                    readExecutionJournalRequest({
                        dataRoot,
                        request: executionJournalRequest,
                        serverId: attachment.serverId,
                    }).then((result) => socket.send(JSON.stringify(result)))
                );
                return;
            }
            const browserRequest = parseBrowserRequest(frame);
            if (browserRequest) {
                void trackWriter(
                    runBrowserRequest(browserRoot, browserRequest).then((result) =>
                        socket.send(JSON.stringify(result))
                    )
                );
                return;
            }
            const reset = parseResetCommand(frame);
            if (reset) {
                if (retiredAgents.has(reset.agentId)) {
                    return;
                }
                resettingAgents.add(reset.agentId);
                const runId = agentRuns.get(reset.agentId);
                if (runId) {
                    running.get(runId)?.abort();
                }
                void trackWriter(
                    agentConfigurations
                        .wait(reset.agentId)
                        .then(() => runSettlements.wait(reset.agentId))
                        .then(async () => {
                            await applyAuthoritativeSession({
                                agentRoot: join(
                                    dataRoot,
                                    'servers',
                                    attachment.serverId,
                                    'agents',
                                    reset.agentId
                                ),
                                generation: reset.sessionGeneration,
                                reset: async () => {
                                    disposeAgentLaunchHost(attachment.serverId, reset.agentId);
                                    await resetAgentState({
                                        agentId: reset.agentId,
                                        dataRoot,
                                        kind: reset.kind,
                                        serverId: attachment.serverId,
                                    });
                                },
                            });
                        })
                        .then(() => sendComputerReport(socket, attachment.serverId, computerName))
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
                    runSettlements
                        .wait(reminderScript.agentId)
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
                if (retiredAgents.has(notice.agentId)) {
                    return;
                }
                const location = {
                    agentId: notice.agentId,
                    dataRoot,
                    serverId: attachment.serverId,
                };
                let injected = false;
                void trackWriter(
                    replacePendingInbox(
                        location,
                        notice.inbox,
                        notice.totalPending,
                        async (projected) => {
                            const sink = noticeSinks.get(notice.agentId);
                            if (sink?.runId === notice.runId) {
                                injected = await sink.deliver(projected);
                            }
                        },
                        { runId: notice.runId, workIds: notice.inbox.map((item) => item.id) }
                    )
                        .then(() => {
                            if (injected) {
                                socket.send(
                                    JSON.stringify({
                                        agentId: notice.agentId,
                                        runId: notice.runId,
                                        type: 'notice-ack',
                                        workIds: notice.inbox.map((item) => item.id),
                                    })
                                );
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
                const pendingConfiguration = agentConfigurations.wait(command.agentId);
                void trackWriter(
                    pendingConfiguration.then(() => startAgent(command)).catch(reportStateError)
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

/**
 * Handles one start command idempotently. The run is already reserved in
 * `running` (synchronously, by the caller), so only one launch per run can exist.
 * Local acceptance (the durable marker plus the ack) is recorded before any model
 * work. A settled run replays its summary; an accepted-but-unsettled run
 * intentionally replays after restart because acceptance is not model-seen
 * proof.
 */
async function handleStartCommand(input: {
    attachment: Attachment;
    command: AgentStartCommand;
    computerName: string;
    controller: AbortController;
    clearActiveRun: () => Promise<void>;
    noticeSinks: Map<string, { deliver: (notice: string) => Promise<boolean>; runId: string }>;
    releaseRun: () => void;
    socket: WebSocket;
}): Promise<void> {
    const {
        attachment,
        clearActiveRun,
        command,
        computerName,
        controller,
        noticeSinks,
        releaseRun,
        socket,
    } = input;
    const startedAt = new Date().toISOString();
    const send = (frame: unknown) => socket.send(JSON.stringify(frame));
    const ack = () => send({ agentId: command.agentId, runId: command.runId, type: 'ack' });
    const settle = async (summary: AgentTurnFrame) => {
        send(summary);
        await writeRunMarker(dataRoot, {
            marker: { status: 'settled', summary },
            runId: command.runId,
            serverId: attachment.serverId,
        });
        await clearRunVisibleMessages(
            { agentId: command.agentId, dataRoot, serverId: attachment.serverId },
            command.runId
        );
    };

    try {
        const marker = await readRunMarker(dataRoot, command, attachment.serverId);
        const decision = decideStart(marker);
        if (decision.kind === 'replay') {
            ack();
            send(decision.summary);
            return;
        }
        if (marker?.status === 'accepted') {
            await prepareRunReplay(
                { agentId: command.agentId, dataRoot, serverId: attachment.serverId },
                command.runId
            );
        }
        let modelInbox = command.inbox ?? [];
        const launchCommand = { ...command, inbox: modelInbox };
        let summary: AgentTurnFrame;
        try {
            summary = await runAgentLaunch({
                attachment,
                command: launchCommand,
                dataRoot,
                onRuntimeReady: async () => {
                    const location = {
                        agentId: command.agentId,
                        dataRoot,
                        serverId: attachment.serverId,
                    };
                    if (command.inboxDelivery === 'notice') {
                        await reofferPendingMessages(location, command.inbox ?? []);
                        await replacePendingInbox(
                            location,
                            command.inbox ?? [],
                            command.totalPending
                        );
                    } else {
                        if (marker?.status !== 'accepted') {
                            await reofferPendingMessages(location, command.inbox ?? []);
                        }
                        modelInbox = await acceptRunInbox(
                            location,
                            command.runId,
                            command.inbox ?? []
                        );
                        launchCommand.inbox = modelInbox;
                    }
                    await writeRunMarker(dataRoot, {
                        marker: { status: 'accepted' },
                        runId: command.runId,
                        serverId: attachment.serverId,
                    });
                    ack();
                },
                onStoredNoticeDelivered: (receipt) => {
                    send({
                        agentId: command.agentId,
                        ...receipt,
                        type: 'notice-ack',
                    });
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
        await clearRunVisibleMessages(
            { agentId: command.agentId, dataRoot, serverId: attachment.serverId },
            command.runId
        );
        await sendComputerReport(socket, attachment.serverId, computerName).catch(reportStateError);
    } finally {
        await clearActiveRun();
        releaseRun();
    }
}

async function sendComputerReport(socket: WebSocket, serverId: string, computerName: string) {
    socket.send(
        JSON.stringify({
            agents: await readEffectiveAgentStates(dataRoot, serverId),
            inventory: {
                ...detectInventory(),
                agentSkillImports: await listAgentSkillImportReports(dataRoot, serverId),
                agentSkills: await listAgentSkillReports(dataRoot, serverId),
                importableSkills: await listImportableSkills(),
                name: computerName,
            },
            type: 'report',
        })
    );
}

async function sendUsageReport(socket: WebSocket) {
    const usage = await readCachedComputerUsage({
        openRouterManagementKey: await readOpenRouterManagementKey(dataRoot),
    });
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'usage-report', usage }));
    }
}

function reportStateError(error: unknown) {
    console.error(
        `Computer state report failed: ${error instanceof Error ? error.message : error}`
    );
}

function launchCrashTurn(
    command: AgentStartCommand,
    startedAt: string,
    error: unknown
): AgentTurnFrame {
    return {
        agentId: command.agentId,
        endedAt: new Date().toISOString(),
        messageCount: 0,
        modelId: command.modelId,
        outputProduced: false,
        runId: command.runId,
        runtimeId: command.runtimeId,
        startedAt,
        status: 'failed',
        summary: `The Agent launch failed: ${error instanceof Error ? error.message : String(error)}`,
        tokenUsage: null,
        type: 'turn',
        visibleMessages: [],
    };
}

function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

if (import.meta.main) {
    try {
        await main(process.argv.slice(2));
    } catch (error) {
        const stderrRenderer = createCliRenderer({
            colors: cliColorsEnabled(process.env, process.stderr.isTTY === true),
        });
        console.error(stderrRenderer.fail(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
    }
}
