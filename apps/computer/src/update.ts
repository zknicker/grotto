import { verify } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { computerReleasePublicKey, computerVersion } from './build-identity.ts';
import {
    type ComputerUpdateProgress,
    computerProtocolVersion,
    computerReleaseSigningPayload,
    parseSignedComputerRelease,
    type SignedComputerRelease,
} from './update-contract.ts';
import {
    downloadAndVerifyArtifact,
    installStandaloneExecutable,
    rollbackStandaloneExecutable,
} from './update-install.ts';
import { tryAcquirePidLock, withUpdateLock } from './update-locks.ts';

export const productionComputerManifestUrl = 'https://releases.grotto.sh/computer/latest.json';

export async function readUpdateProgress(dataRoot: string): Promise<ComputerUpdateProgress> {
    try {
        const stored = JSON.parse(
            await readFile(progressPath(dataRoot), 'utf8')
        ) as Partial<ComputerUpdateProgress>;
        return {
            activeAgentCount: stored.activeAgentCount ?? null,
            detail: stored.detail ?? null,
            downloadedBytes: stored.downloadedBytes ?? null,
            failedPhase: stored.failedPhase ?? null,
            phase: stored.phase ?? 'idle',
            targetVersion: stored.targetVersion ?? null,
            totalBytes: stored.totalBytes ?? null,
            updatedAt: stored.updatedAt ?? new Date().toISOString(),
        };
    } catch {
        return progress('idle', null, null);
    }
}

export async function writeUpdateProgress(
    dataRoot: string,
    next: ComputerUpdateProgress
): Promise<void> {
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    const destination = progressPath(dataRoot);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
}

export function progress(
    phase: ComputerUpdateProgress['phase'],
    targetVersion: string | null,
    detail: string | null,
    fields: Partial<
        Pick<
            ComputerUpdateProgress,
            'activeAgentCount' | 'downloadedBytes' | 'failedPhase' | 'totalBytes'
        >
    > = {}
): ComputerUpdateProgress {
    return {
        activeAgentCount: fields.activeAgentCount ?? null,
        detail,
        downloadedBytes: fields.downloadedBytes ?? null,
        failedPhase: fields.failedPhase ?? null,
        phase,
        targetVersion,
        totalBytes: fields.totalBytes ?? null,
        updatedAt: new Date().toISOString(),
    };
}

export async function readProductionRelease(
    manifestUrl = process.env.GROTTO_COMPUTER_RELEASE_MANIFEST_URL ?? productionComputerManifestUrl
): Promise<SignedComputerRelease> {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
        throw new Error(`Production release check failed (${response.status}).`);
    }
    return parseSignedComputerRelease(await response.json());
}

export function verifySignedRelease(
    signed: SignedComputerRelease,
    publicKey = requiredPublicKey()
): void {
    const valid = verify(
        null,
        Buffer.from(computerReleaseSigningPayload(signed.release)),
        publicKey,
        Buffer.from(signed.signature, 'base64')
    );
    if (!valid) {
        throw new Error('Computer release signature verification failed.');
    }
}

export async function runSignedUpdate(input: {
    dataRoot: string;
    currentVersion?: string;
    install?: (artifactPath: string) => Promise<void>;
    publicKey?: string;
    release: SignedComputerRelease;
    restart: () => Promise<void>;
    verifyArtifact?: (path: string) => Promise<void>;
}): Promise<void> {
    const { dataRoot, release } = input;
    const targetVersion = release.release.version;
    const releaseLock = await tryAcquirePidLock(join(dataRoot, 'update-job.lock'));
    if (!releaseLock) {
        return;
    }
    let failedPhase: Exclude<ComputerUpdateProgress['phase'], 'failed'> = 'requested';
    try {
        if (!isNewerVersion(targetVersion, input.currentVersion ?? computerVersion)) {
            throw new Error(`Grotto Computer ${targetVersion} is not a newer release.`);
        }
        if (release.release.protocolVersion < computerProtocolVersion) {
            throw new Error('Computer release protocol is older than this Computer.');
        }
        await writeUpdateProgress(
            dataRoot,
            progress('requested', targetVersion, 'Download requested.')
        );
        failedPhase = 'verifying';
        verifySignedRelease(release, input.publicKey ?? requiredPublicKey());
        failedPhase = 'downloading';
        const artifactPath = await downloadAndVerifyArtifact({
            onProgress: async ({ downloadedBytes, totalBytes }) => {
                await writeUpdateProgress(
                    dataRoot,
                    progress(
                        'downloading',
                        targetVersion,
                        `Downloading Grotto Computer ${targetVersion}.`,
                        { downloadedBytes, totalBytes }
                    )
                );
            },
            onVerify: async () => {
                failedPhase = 'verifying';
                await writeUpdateProgress(
                    dataRoot,
                    progress('verifying', targetVersion, 'Verifying signature and integrity.')
                );
            },
            release,
            verifyArtifact: input.verifyArtifact,
        });
        try {
            failedPhase = 'waiting-for-agents';
            await closeTurnAdmission(dataRoot, targetVersion);
            await waitForActiveRuns(dataRoot, targetVersion);
            failedPhase = 'installing';
            await writeUpdateProgress(
                dataRoot,
                progress('installing', targetVersion, 'Installing update.')
            );
            await (input.install ?? installStandaloneExecutable)(artifactPath);
        } finally {
            await rm(dirname(artifactPath), { force: true, recursive: true });
        }
        failedPhase = 'restarting';
        await writeUpdateProgress(
            dataRoot,
            progress('restarting', targetVersion, 'Restarting Grotto Computer.')
        );
        await input.restart();
    } catch (cause) {
        const current = await readUpdateProgress(dataRoot);
        await writeUpdateProgress(
            dataRoot,
            progress(
                'failed',
                targetVersion,
                cause instanceof Error ? cause.message : 'Computer update failed.',
                {
                    downloadedBytes: current.downloadedBytes,
                    failedPhase,
                    totalBytes: current.totalBytes,
                }
            )
        );
        throw cause;
    } finally {
        await releaseLock();
    }
}

export async function rollbackComputer(input: { restart: () => Promise<void> }): Promise<void> {
    await rollbackStandaloneExecutable();
    await input.restart();
}

export async function admitActiveRun(
    dataRoot: string,
    runId: string
): Promise<(() => Promise<void>) | null> {
    return await withUpdateLock(dataRoot, async () => {
        const { phase } = await readUpdateProgress(dataRoot);
        if (['waiting-for-agents', 'installing', 'restarting'].includes(phase)) {
            return null;
        }
        const root = activeRunsRoot(dataRoot);
        await mkdir(root, { mode: 0o700, recursive: true });
        const marker = join(root, runId);
        await writeFile(marker, `${process.pid}\n`, { mode: 0o600 });
        return async () => await rm(marker, { force: true });
    });
}

async function waitForActiveRuns(dataRoot: string, targetVersion: string): Promise<void> {
    for (;;) {
        const active = await readdir(activeRunsRoot(dataRoot)).catch(() => []);
        const alive = await Promise.all(
            active.map(async (runId) => {
                const marker = join(activeRunsRoot(dataRoot), runId);
                try {
                    const pid = Number.parseInt(await readFile(marker, 'utf8'), 10);
                    process.kill(pid, 0);
                    return true;
                } catch {
                    await rm(marker, { force: true });
                    return false;
                }
            })
        );
        const activeAgentCount = alive.filter(Boolean).length;
        await writeUpdateProgress(
            dataRoot,
            progress(
                'waiting-for-agents',
                targetVersion,
                activeAgentCount === 1
                    ? 'Waiting for 1 active Agent.'
                    : `Waiting for ${activeAgentCount} active Agents.`,
                { activeAgentCount }
            )
        );
        if (activeAgentCount === 0) {
            return;
        }
        await Bun.sleep(250);
    }
}

async function closeTurnAdmission(dataRoot: string, targetVersion: string) {
    await withUpdateLock(dataRoot, async () => {
        await writeUpdateProgress(
            dataRoot,
            progress('waiting-for-agents', targetVersion, 'Waiting for active Agents to finish.', {
                activeAgentCount: 0,
            })
        );
    });
}

function requiredPublicKey(): string {
    if (!computerReleasePublicKey) {
        throw new Error('This Computer does not contain a production release trust anchor.');
    }
    return computerReleasePublicKey.replaceAll('\\n', '\n');
}

function progressPath(dataRoot: string) {
    return join(dataRoot, 'update.json');
}

function activeRunsRoot(dataRoot: string) {
    return join(dataRoot, 'update-active-runs');
}

function isNewerVersion(candidate: string, installed: string) {
    const parse = (version: string) => version.split('.').map(Number);
    const candidateParts = parse(candidate);
    const installedParts = parse(installed);
    for (let index = 0; index < 3; index += 1) {
        if (candidateParts[index] !== installedParts[index]) {
            return (candidateParts[index] ?? 0) > (installedParts[index] ?? 0);
        }
    }
    return false;
}
