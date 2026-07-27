#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
    assertGrottoRevision,
    verifyGrottoRelease,
} from '../apps/server/src/grotto-release-verification.ts';

const productionRoot = '/Users/zknicker/srv/grotto';
const activationHelper = '/usr/local/libexec/grotto/activate-grotto-server';
const versionTagPattern = /^v(\d+\.\d+\.\d+)$/u;

interface InstallGrottoReleaseInput {
    artifactPath: string;
    deployRoot: string;
    sourceRevision: string;
}

export function readGrottoBuildValue(envPath: string, key: string) {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) {
        throw new Error('Grotto build value name must be an environment identifier.');
    }

    const values = readFileSync(envPath, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => !line.startsWith('#'))
        .filter((line) => line.startsWith(`${key}=`))
        .map((line) => stripMatchingQuotes(line.slice(key.length + 1).trim()));

    if (values.length !== 1 || !values[0]) {
        throw new Error(`${key} must appear exactly once with a nonempty value in ${envPath}.`);
    }
    return values[0];
}

export function parseGrottoDeployArguments(args: string[]) {
    const [versionTag, mode, sourceRevision, ...extra] = args.filter(
        (argument) => argument !== '--'
    );
    const versionMatch = versionTag?.match(versionTagPattern);
    if (!(versionMatch && mode === 'deploy' && sourceRevision) || extra.length) {
        throw new Error('Usage: deploy:grotto-server vX.Y.Z deploy FULL_GIT_SHA');
    }
    assertGrottoRevision(sourceRevision);
    return {
        productVersion: versionMatch[1],
        sourceRevision,
        versionTag,
    };
}

export async function installGrottoRelease(input: InstallGrottoReleaseInput) {
    assertGrottoRevision(input.sourceRevision);
    await verifyArtifactChecksum(input.artifactPath);

    const releasesRoot = join(input.deployRoot, 'releases');
    const releaseRoot = join(releasesRoot, input.sourceRevision);
    await mkdir(releasesRoot, { recursive: true });
    const candidateRoot = await mkdtemp(join(releasesRoot, `.${input.sourceRevision}.`));

    try {
        run('/usr/bin/tar', ['-xzf', input.artifactPath, '-C', candidateRoot]);
        const candidate = await verifyGrottoRelease(candidateRoot, input.sourceRevision);

        if (await pathExists(releaseRoot)) {
            const existing = await verifyGrottoRelease(releaseRoot, input.sourceRevision);
            if (existing.contentDigest !== candidate.contentDigest) {
                throw new Error(
                    `Grotto release ${input.sourceRevision} already exists with different content.`
                );
            }
            return releaseRoot;
        }

        await rename(candidateRoot, releaseRoot);
        return releaseRoot;
    } finally {
        await rm(candidateRoot, { force: true, recursive: true });
    }
}

async function main() {
    const { productVersion, sourceRevision } = parseGrottoDeployArguments(process.argv.slice(2));

    const websitePackage = JSON.parse(
        await readFile(join(import.meta.dir, '../apps/website/package.json'), 'utf8')
    ) as { version: string };
    if (websitePackage.version !== productVersion) {
        throw new Error('Published tag does not match the Grotto product version.');
    }

    const publishableKey = readGrottoBuildValue(
        join(productionRoot, '.env'),
        'VITE_CLERK_PUBLISHABLE_KEY'
    );
    run('bun', ['--no-env-file', 'run', 'build:grotto-server-artifact'], {
        cwd: join(import.meta.dir, '..'),
        env: {
            ...process.env,
            GROTTO_SOURCE_REVISION: sourceRevision,
            VITE_CLERK_PUBLISHABLE_KEY: publishableKey,
        },
        stdio: 'inherit',
    });

    const releaseId = `${websitePackage.version}+git.${sourceRevision.slice(0, 12)}`;
    await installGrottoRelease({
        artifactPath: join(
            import.meta.dir,
            `../apps/server/release/grotto-server-${releaseId}-aarch64-apple-darwin.tar.gz`
        ),
        deployRoot: productionRoot,
        sourceRevision,
    });

    run('/usr/bin/sudo', ['-n', activationHelper, sourceRevision], { stdio: 'inherit' });
}

async function verifyArtifactChecksum(artifactPath: string) {
    const checksumSource = await readFile(`${artifactPath}.sha256`, 'utf8');
    const match = checksumSource.match(/^([0-9a-f]{64}) {2}([^/\n]+)\n$/u);
    if (!(match && match[2] === basename(artifactPath))) {
        throw new Error('Grotto artifact checksum file is invalid.');
    }
    if ((await sha256(artifactPath)) !== match[1]) {
        throw new Error('Grotto artifact checksum does not match.');
    }
}

async function pathExists(path: string) {
    try {
        await lstat(path);
        return true;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

async function sha256(path: string) {
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
        createReadStream(path)
            .on('data', (chunk) => hash.update(chunk))
            .on('error', reject)
            .on('end', resolve);
    });
    return hash.digest('hex');
}

function stripMatchingQuotes(value: string) {
    const first = value[0];
    return first && first === value.at(-1) && (first === '"' || first === "'")
        ? value.slice(1, -1)
        : value;
}

function run(
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: 'inherit' } = {}
) {
    const result = Bun.spawnSync([command, ...args], {
        cwd: options.cwd,
        env: options.env,
        stderr: options.stdio ?? 'pipe',
        stdout: options.stdio ?? 'pipe',
    });
    if (result.exitCode !== 0) {
        throw new Error(`${basename(command)} failed with exit code ${result.exitCode}.`);
    }
}

if (import.meta.main) {
    await main();
}
