import { createHash, verify } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
    type ComputerUpdateProgress,
    computerReleaseSigningPayload,
    parseSignedComputerRelease,
    type SignedComputerRelease,
} from './update-contract.ts';

export const productionComputerManifestUrl = 'https://releases.grotto.sh/computer/latest.json';

export async function readUpdateProgress(dataRoot: string): Promise<ComputerUpdateProgress> {
    try {
        return JSON.parse(await readFile(progressPath(dataRoot), 'utf8')) as ComputerUpdateProgress;
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
    detail: string | null
): ComputerUpdateProgress {
    return { detail, phase, targetVersion, updatedAt: new Date().toISOString() };
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
    install?: (tarballPath: string) => Promise<void>;
    publicKey?: string;
    release: SignedComputerRelease;
    restart: () => Promise<void>;
}): Promise<void> {
    const { dataRoot, release } = input;
    const targetVersion = release.release.version;
    const releaseLock = await tryAcquirePidLock(join(dataRoot, 'update-job.lock'));
    if (!releaseLock) {
        return;
    }
    try {
        await writeUpdateProgress(
            dataRoot,
            progress('installing', targetVersion, 'Downloading and verifying the signed release.')
        );
        verifySignedRelease(release, input.publicKey ?? (await readConfiguredPublicKey(dataRoot)));
        const temporaryRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-update-'));
        try {
            const tarballPath = join(temporaryRoot, 'computer.tgz');
            await downloadVerifiedTarball(release, tarballPath);
            await closeTurnAdmission(dataRoot, targetVersion);
            await waitForActiveRuns(dataRoot);
            await (input.install ?? installTarball)(tarballPath);
        } finally {
            await rm(temporaryRoot, { force: true, recursive: true });
        }
        await writeUpdateProgress(
            dataRoot,
            progress('restarting', targetVersion, 'Restarting Grotto Computer.')
        );
        await input.restart();
    } catch (cause) {
        await writeUpdateProgress(
            dataRoot,
            progress(
                'failed',
                targetVersion,
                cause instanceof Error ? cause.message : 'Computer update failed.'
            )
        );
        throw cause;
    } finally {
        await releaseLock();
    }
}

export async function admitActiveRun(
    dataRoot: string,
    runId: string
): Promise<(() => Promise<void>) | null> {
    return await withUpdateLock(dataRoot, async () => {
        const { phase } = await readUpdateProgress(dataRoot);
        if (['waiting-for-agents', 'restarting'].includes(phase)) {
            return null;
        }
        const root = activeRunsRoot(dataRoot);
        await mkdir(root, { mode: 0o700, recursive: true });
        const marker = join(root, runId);
        await writeFile(marker, `${process.pid}\n`, { mode: 0o600 });
        return async () => await rm(marker, { force: true });
    });
}

async function downloadVerifiedTarball(
    signed: SignedComputerRelease,
    destination: string
): Promise<void> {
    const response = await fetch(signed.release.tarballUrl);
    if (!response.ok) {
        throw new Error(`Computer release download failed (${response.status}).`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== signed.release.sha256) {
        throw new Error('Computer release checksum verification failed.');
    }
    await writeFile(destination, bytes, { mode: 0o600 });
}

async function waitForActiveRuns(dataRoot: string): Promise<void> {
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
        if (!alive.includes(true)) {
            return;
        }
        await Bun.sleep(250);
    }
}

async function closeTurnAdmission(dataRoot: string, targetVersion: string) {
    await withUpdateLock(dataRoot, async () => {
        await writeUpdateProgress(
            dataRoot,
            progress('waiting-for-agents', targetVersion, 'Waiting for active Agents to finish.')
        );
    });
}

async function withUpdateLock<Result>(
    dataRoot: string,
    operation: () => Promise<Result>
): Promise<Result> {
    const lock = join(dataRoot, 'update-admission.lock');
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    for (;;) {
        try {
            await mkdir(lock, { mode: 0o700 });
            await writeFile(join(lock, 'pid'), `${process.pid}\n`, { mode: 0o600 });
            break;
        } catch (cause) {
            if (!(cause instanceof Error && 'code' in cause && cause.code === 'EEXIST')) {
                throw cause;
            }
            await clearStaleLock(lock);
            await Bun.sleep(20);
        }
    }
    try {
        return await operation();
    } finally {
        await rm(lock, { force: true, recursive: true });
    }
}

async function tryAcquirePidLock(lock: string): Promise<(() => Promise<void>) | null> {
    await mkdir(dirname(lock), { mode: 0o700, recursive: true });
    for (;;) {
        try {
            await writeFile(lock, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
            return async () => await rm(lock, { force: true });
        } catch (cause) {
            if (!(cause instanceof Error && 'code' in cause && cause.code === 'EEXIST')) {
                throw cause;
            }
            if (!(await removeDeadLockFile(lock))) {
                return null;
            }
        }
    }
}

async function clearStaleLock(lock: string) {
    try {
        const pid = Number.parseInt(await readFile(join(lock, 'pid'), 'utf8'), 10);
        process.kill(pid, 0);
    } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
            return;
        }
        await rm(lock, { force: true, recursive: true });
    }
}

async function removeDeadLockFile(lock: string) {
    try {
        const pid = Number.parseInt(await readFile(lock, 'utf8'), 10);
        process.kill(pid, 0);
        return false;
    } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
            return true;
        }
        await rm(lock, { force: true });
        return true;
    }
}

async function installTarball(tarballPath: string): Promise<void> {
    const child = Bun.spawn(['npm', 'install', '--global', tarballPath], {
        stderr: 'inherit',
        stdin: 'ignore',
        stdout: 'inherit',
    });
    if ((await child.exited) !== 0) {
        throw new Error('The verified Computer release could not be installed.');
    }
}

function requiredPublicKey(): string {
    const publicKey = process.env.GROTTO_COMPUTER_UPDATE_PUBLIC_KEY;
    if (!publicKey) {
        throw new Error('The Computer production release key is not configured.');
    }
    return publicKey.replaceAll('\\n', '\n');
}

async function readConfiguredPublicKey(dataRoot: string) {
    const fromEnvironment = process.env.GROTTO_COMPUTER_UPDATE_PUBLIC_KEY;
    if (fromEnvironment) {
        return fromEnvironment.replaceAll('\\n', '\n');
    }
    try {
        return await readFile(join(dataRoot, 'update-public-key.pem'), 'utf8');
    } catch {
        throw new Error('The Computer production release key is not configured.');
    }
}

function progressPath(dataRoot: string) {
    return join(dataRoot, 'update.json');
}

function activeRunsRoot(dataRoot: string) {
    return join(dataRoot, 'update-active-runs');
}
