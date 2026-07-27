#!/usr/bin/env bun

import { lstat, readlink, realpath, rename, rm, symlink } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { assertGrottoRevision, verifyGrottoRelease } from './grotto-release-verification.ts';

const productionRoot = '/Users/zknicker/srv/grotto';
const privilegedActivationHelper = '/usr/local/libexec/grotto/activate-grotto-server';
const serverLabel = 'system/com.grotto.server';
const serverHealthUrl = 'http://127.0.0.1:18791/healthz';
const fileTypeMask = 0o17_0000;
const directoryType = 0o04_0000;
const regularFileType = 0o10_0000;

interface ActivateGrottoReleaseInput {
    deployRoot: string;
    restartServer(): Promise<string | null> | string | null;
    serverHealthy(previousPid: string | null): Promise<boolean>;
    sourceRevision: string;
}

interface ActivationPathStat {
    mode: number;
    uid: number;
}

export async function activateGrottoRelease(input: ActivateGrottoReleaseInput) {
    assertGrottoRevision(input.sourceRevision);
    const deployRoot = resolve(input.deployRoot);
    const releaseRoot = join(deployRoot, 'releases', input.sourceRevision);
    const release = await verifyContainedRelease(deployRoot, releaseRoot, input.sourceRevision);
    const currentPath = join(deployRoot, 'current');
    const previousRelease = await readCurrentRelease(deployRoot, currentPath);

    await switchCurrentRelease(deployRoot, currentPath, releaseRoot);
    try {
        const previousPid = await input.restartServer();
        if (!(await input.serverHealthy(previousPid))) {
            throw new Error('Activated Grotto Server did not become healthy.');
        }
    } catch (error) {
        if (previousRelease) {
            await switchCurrentRelease(deployRoot, currentPath, previousRelease);
            await input.restartServer();
        } else {
            await rm(currentPath, { force: true });
        }
        throw new Error('Grotto Server activation failed and rolled back.', { cause: error });
    }

    return release;
}

async function readCurrentRelease(deployRoot: string, currentPath: string) {
    let target: string;
    try {
        target = await readlink(currentPath);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
    if (!isAbsolute(target)) {
        throw new Error('Current Grotto release must use an absolute release path.');
    }
    const sourceRevision = basename(target);
    assertGrottoRevision(sourceRevision);
    await verifyContainedRelease(deployRoot, target, sourceRevision);
    return target;
}

async function switchCurrentRelease(deployRoot: string, currentPath: string, releaseRoot: string) {
    const nextPath = join(deployRoot, `.current.${process.pid}`);
    await rm(nextPath, { force: true });
    await symlink(releaseRoot, nextPath);
    await rename(nextPath, currentPath);
}

async function verifyContainedRelease(
    deployRoot: string,
    releaseRoot: string,
    sourceRevision: string
) {
    const canonicalDeployRoot = await realpath(deployRoot);
    const canonicalReleaseRoot = await realpath(releaseRoot);
    if (canonicalReleaseRoot !== join(canonicalDeployRoot, 'releases', sourceRevision)) {
        throw new Error('Grotto release resolves outside the production release root.');
    }
    return verifyGrottoRelease(releaseRoot, sourceRevision);
}

async function restartProductionServer() {
    const previousPid = readProductionServerPid();
    run('/bin/launchctl', ['kickstart', '-k', serverLabel]);
    return previousPid;
}

export async function waitForRestartedServerHealth(
    previousPid: string | null,
    probe = {
        readServerPid: readProductionServerPid,
        serverHealthy: fetchProductionServerHealth,
        sleep: () => Bun.sleep(1000),
    }
) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const currentPid = probe.readServerPid();
        if (currentPid && currentPid !== previousPid && (await probe.serverHealthy())) {
            return true;
        }
        await probe.sleep();
    }
    return false;
}

export async function assertPrivilegedActivationHelper(
    actualPath: string,
    inspect: (path: string) => Promise<ActivationPathStat> = lstat
) {
    if (actualPath !== privilegedActivationHelper) {
        throw new Error('Grotto activation must run from the exact root-owned path.');
    }

    const components = [
        ['/usr/local', directoryType],
        ['/usr/local/libexec', directoryType],
        ['/usr/local/libexec/grotto', directoryType],
        [privilegedActivationHelper, regularFileType],
    ] as const;
    for (const [path, expectedType] of components) {
        const stat = await inspect(path);
        if (
            stat.uid !== 0 ||
            (stat.mode & 0o022) !== 0 ||
            (stat.mode & fileTypeMask) !== expectedType
        ) {
            throw new Error(`${path} must be root-owned and not writable by the deploy runner.`);
        }
    }
}

function readProductionServerPid() {
    const result = Bun.spawnSync(['/bin/launchctl', 'print', serverLabel], {
        stderr: 'pipe',
        stdout: 'pipe',
    });
    if (result.exitCode !== 0) {
        throw new Error(`launchctl failed with exit code ${result.exitCode}.`);
    }
    return result.stdout.toString().match(/^\s*pid = (\d+)$/mu)?.[1] ?? null;
}

async function fetchProductionServerHealth() {
    try {
        const response = await fetch(serverHealthUrl, {
            signal: AbortSignal.timeout(1000),
        });
        if (!response.ok) {
            return false;
        }
        return (await response.json()).status === 'ok';
    } catch {
        return false;
    }
}

function run(command: string, args: string[], cwd?: string) {
    const result = Bun.spawnSync([command, ...args], {
        cwd,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    if (result.exitCode !== 0) {
        throw new Error(`${basename(command)} failed with exit code ${result.exitCode}.`);
    }
}

async function main() {
    await assertPrivilegedActivationHelper(process.execPath);
    const [sourceRevision, ...extra] = process.argv.slice(2);
    if (!(sourceRevision && extra.length === 0)) {
        throw new Error('Usage: activate-grotto-server FULL_GIT_SHA');
    }

    const release = await activateGrottoRelease({
        deployRoot: productionRoot,
        restartServer: restartProductionServer,
        serverHealthy: waitForRestartedServerHealth,
        sourceRevision,
    });
    console.log(
        `Activated Grotto Server ${release.releaseId} (${release.sourceRevision}, ${release.contentDigest}).`
    );
}

if (import.meta.main) {
    await main();
}
