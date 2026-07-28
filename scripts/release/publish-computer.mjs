#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    buildComputerArtifact,
    signAndNotarizeComputer,
    verifyAppleSignature,
    verifyComputerIdentity,
} from './build-computer-artifact.mjs';
import {
    computerArtifactName,
    computerProtocolVersion,
    createSignedComputerRelease,
    publishComputerInOrder,
    sha256File,
    verifySignedComputerRelease,
} from './computer-release-contract.mjs';
import { assertReleaseSurfaceDecision } from './release-surfaces.mjs';
import { fail, isSemver, loadEnvFile, readJson, repoRoot } from './release-utils.mjs';

loadEnvFile();

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const dryRun = args.includes('--dry-run');
const version = args.find((arg) => !arg.startsWith('-'));
const releaseBaseUrl = (
    process.env.GROTTO_COMPUTER_RELEASE_BASE_URL ?? 'https://releases.grotto.sh/computer'
).replace(/\/+$/u, '');

await main();

async function main() {
    if (!(version && isSemver(version))) {
        fail('usage: bun run computer:release [-- --dry-run] <X.Y.Z>');
    }
    requireMacArm64();
    const sourceRevision = git('rev-parse', 'HEAD').trim();
    const privateKey =
        process.env.GROTTO_COMPUTER_RELEASE_PRIVATE_KEY?.replaceAll('\\n', '\n') ??
        (dryRun
            ? generateKeyPairSync('ed25519').privateKey.export({
                  format: 'pem',
                  type: 'pkcs8',
              })
            : requiredEnv('GROTTO_COMPUTER_RELEASE_PRIVATE_KEY').replaceAll('\\n', '\n'));
    const appleTeamId = dryRun
        ? (process.env.APPLE_TEAM_ID ?? 'DRYRUN0000')
        : requiredEnv('APPLE_TEAM_ID');
    const appleSigningIdentity = dryRun
        ? (configuredSigningIdentity() ?? 'Developer ID Application: Grotto (DRYRUN0000)')
        : requiredSigningIdentity();
    assertSource(sourceRevision);
    if (!dryRun) {
        await assertPublishState(version);
        requirePublishingEnvironment();
    }
    run('bun', ['run', '--filter', '@tavern/api', 'typecheck']);
    run('bun', ['run', '--filter', '@tavern/computer', 'test']);
    run('bun', ['run', '--filter', '@tavern/computer', 'typecheck']);
    const built = await buildComputerArtifact({
        appleSigningIdentity,
        appleTeamId,
        privateKey,
        sourceRevision,
        version,
    });
    if (dryRun) {
        console.log(`Computer ${version} dry run passed: ${built.artifactPath}`);
        return;
    }
    const notarizationArchive = signAndNotarizeComputer(built.artifactPath, {
        appleSigningIdentity,
        appleTeamId,
    });
    await verifyComputerIdentity(built.artifactPath, { sourceRevision, version });
    const release = {
        artifactUrl: `${releaseBaseUrl}/${version}/${computerArtifactName}`,
        protocolVersion: computerProtocolVersion,
        sha256: await sha256File(built.artifactPath),
        sourceRevision,
        version,
    };
    const descriptor = createSignedComputerRelease(release, privateKey);
    verifySignedComputerRelease(descriptor, built.publicKey);
    const descriptorPath = path.join(path.dirname(built.artifactPath), 'release.json');
    await writeFile(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
    const installerPath = await renderInstaller({ appleSigningIdentity, appleTeamId });
    await publishComputerInOrder({
        promoteLatest: async () => await promoteLatest(descriptorPath),
        publishImmutable: async () =>
            await publishImmutableObjects({
                artifactPath: built.artifactPath,
                descriptorPath,
                installerPath,
                version,
            }),
        verifyImmutable: async () =>
            await verifyPublicObjects({
                appleSigningIdentity,
                appleTeamId,
                descriptor,
                publicKey: built.publicKey,
                sourceRevision,
                version,
            }),
        verifyLatest: async () =>
            await verifyPublicDescriptor(
                `${releaseBaseUrl}/latest.json`,
                descriptor,
                built.publicKey
            ),
    });
    await promoteInstaller(installerPath);
    const tag = `computer-v${version}`;
    run('git', ['tag', '-a', tag, '-m', tag]);
    run('git', ['push', 'origin', tag]);
    run('gh', [
        'release',
        'create',
        tag,
        built.artifactPath,
        descriptorPath,
        installerPath,
        notarizationArchive,
        '--title',
        tag,
        '--notes',
        `Signed Grotto Computer ${version} (protocol ${computerProtocolVersion}, ${sourceRevision}).`,
    ]);
    console.log(`Published and verified ${tag}.`);
}

async function publishImmutableObjects(input) {
    const root = `${requiredEnv('TAVERN_RELEASE_S3_URI').replace(/\/+$/u, '')}/computer/${input.version}`;
    for (const [file, name] of [
        [input.artifactPath, computerArtifactName],
        [input.descriptorPath, 'release.json'],
        [input.installerPath, 'install.sh'],
    ]) {
        const uri = `${root}/${name}`;
        if (spawnSync('aws', ['s3', 'ls', uri], { stdio: 'ignore' }).status === 0) {
            fail(`immutable Computer release object already exists: ${uri}`);
        }
        run('aws', ['s3', 'cp', file, uri]);
    }
}

async function verifyPublicObjects(input) {
    const descriptor = await verifyPublicDescriptor(
        `${releaseBaseUrl}/${input.version}/release.json`,
        input.descriptor,
        input.publicKey
    );
    const root = await mkdtemp(path.join(tmpdir(), 'grotto-computer-public-'));
    try {
        const artifactPath = path.join(root, computerArtifactName);
        const response = await retryPublicVerification('public Computer artifact', async () => {
            const candidate = await fetch(descriptor.release.artifactUrl, { cache: 'no-store' });
            if (!candidate.ok) {
                throw new Error(`returned ${candidate.status}`);
            }
            return candidate;
        });
        await writeFile(artifactPath, Buffer.from(await response.arrayBuffer()), { mode: 0o755 });
        if ((await sha256File(artifactPath)) !== descriptor.release.sha256) {
            fail('public Computer artifact digest does not match descriptor');
        }
        verifyAppleSignature(artifactPath, input);
        await verifyComputerIdentity(artifactPath, input);
    } finally {
        await rm(root, { force: true, recursive: true });
    }
}

async function promoteLatest(descriptorPath) {
    const uri = `${requiredEnv('TAVERN_RELEASE_S3_URI').replace(/\/+$/u, '')}/computer/latest.json`;
    run('aws', ['s3', 'cp', descriptorPath, uri, '--cache-control', 'no-cache']);
}

async function promoteInstaller(installerPath) {
    const uri = `${requiredEnv('TAVERN_RELEASE_S3_URI').replace(/\/+$/u, '')}/computer/install.sh`;
    run('aws', [
        's3',
        'cp',
        installerPath,
        uri,
        '--cache-control',
        'no-cache',
        '--content-type',
        'text/x-shellscript',
    ]);
    const expected = await readFile(installerPath, 'utf8');
    await retryPublicVerification('public Computer installer', async () => {
        const response = await fetch(`${releaseBaseUrl}/install.sh`, { cache: 'no-store' });
        if (!response.ok || (await response.text()) !== expected) {
            throw new Error(response.ok ? 'content differs' : `returned ${response.status}`);
        }
    });
}

async function renderInstaller(input) {
    const template = await readFile(
        path.join(repoRoot, 'scripts', 'release', 'install-grotto-computer.sh'),
        'utf8'
    );
    const rendered = template
        .replaceAll('__GROTTO_APPLE_TEAM_ID__', input.appleTeamId)
        .replaceAll('__GROTTO_APPLE_SIGNING_IDENTITY__', input.appleSigningIdentity);
    const installerPath = path.join(repoRoot, 'apps', 'computer', 'release', 'install.sh');
    await writeFile(installerPath, rendered, { mode: 0o755 });
    return installerPath;
}

async function verifyPublicDescriptor(url, expected, publicKey) {
    return await retryPublicVerification(`public Computer descriptor ${url}`, async () => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`returned ${response.status}`);
        }
        const descriptor = await response.json();
        verifySignedComputerRelease(descriptor, publicKey);
        if (JSON.stringify(descriptor) !== JSON.stringify(expected)) {
            throw new Error('content differs from release');
        }
        return descriptor;
    });
}

async function retryPublicVerification(description, verify) {
    let lastError;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try {
            return await verify();
        } catch (error) {
            lastError = error;
            if (attempt < 30) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }
    fail(`${description} verification failed`, {
        message: lastError instanceof Error ? lastError.message : String(lastError),
    });
}

async function assertPublishState(releaseVersion) {
    if (git('status', '--porcelain').trim()) {
        fail('Computer publishing requires a clean worktree');
    }
    const packageJson = await readJson('apps/computer/package.json');
    if (packageJson.version !== releaseVersion) {
        fail(`apps/computer/package.json must be version ${releaseVersion}`);
    }
    const surfaceDecision = await readJson('release-surfaces.json');
    try {
        assertReleaseSurfaceDecision(surfaceDecision, { requireDecision: true });
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
    }
    const computer = surfaceDecision.surfaces.computer;
    if (computer.action !== 'publish' || computer.version !== releaseVersion) {
        fail(`release surface decision must publish Computer ${releaseVersion}`);
    }
    const tag = `computer-v${releaseVersion}`;
    if (
        spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' })
            .status === 0
    ) {
        fail(`tag ${tag} already exists locally`);
    }
    if (
        spawnSync('git', ['ls-remote', '--exit-code', 'origin', `refs/tags/${tag}`], {
            stdio: 'ignore',
        }).status === 0
    ) {
        fail(`tag ${tag} already exists on origin`);
    }
}

function assertSource(sourceRevision) {
    if (!/^[a-f0-9]{40}$/u.test(sourceRevision)) {
        fail('Computer release source must be one exact full Git revision');
    }
}

function requirePublishingEnvironment() {
    requiredEnv('TAVERN_RELEASE_S3_URI');
    const hasAppleId =
        process.env.APPLE_ID?.trim() &&
        (process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() || process.env.APPLE_PASSWORD?.trim());
    const hasApiKey =
        process.env.APPLE_API_KEY?.trim() &&
        process.env.APPLE_API_KEY_ID?.trim() &&
        process.env.APPLE_API_ISSUER?.trim() &&
        process.env.APPLE_API_KEY_PATH?.trim();
    if (!(hasAppleId || hasApiKey)) {
        fail('complete Apple ID or App Store Connect API notarization credentials are required');
    }
    run('gh', ['auth', 'status']);
}

function configuredSigningIdentity() {
    return process.env.CSC_NAME?.trim() || process.env.APPLE_SIGNING_IDENTITY?.trim();
}

function requiredSigningIdentity() {
    const value = configuredSigningIdentity();
    if (!value) {
        fail('missing CSC_NAME or APPLE_SIGNING_IDENTITY keychain identity');
    }
    return value;
}

function requireMacArm64() {
    if (process.platform !== 'darwin' || process.arch !== 'arm64') {
        fail('Computer releases build only on Apple Silicon macOS');
    }
}

function requiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        fail(`missing ${name}`);
    }
    return value;
}

function git(...gitArgs) {
    return execFileSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' });
}

function run(command, commandArgs) {
    execFileSync(command, commandArgs, { cwd: repoRoot, env: process.env, stdio: 'inherit' });
}
