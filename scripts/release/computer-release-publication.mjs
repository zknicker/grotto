import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyAppleSignature, verifyComputerIdentity } from './build-computer-artifact.mjs';
import {
    computerArtifactName,
    sha256File,
    verifySignedComputerRelease,
} from './computer-release-contract.mjs';
import { fail, repoRoot } from './release-utils.mjs';

export async function publishImmutableObjects(input) {
    const root = `${input.s3Root}/computer/${input.version}`;
    for (const [file, name] of [
        [input.artifactPath, computerArtifactName],
        [input.descriptorPath, 'release.json'],
        [input.installerPath, 'install.sh'],
    ]) {
        const uri = `${root}/${name}`;
        assertImmutableObjectAbsent(uri);
        run('aws', ['s3', 'cp', file, uri]);
    }
}

export function assertImmutableObjectAbsent(uri, execute = spawnSync) {
    const result = execute('aws', ['s3', 'ls', uri], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`Could not check immutable Computer release object: ${uri}`);
    }
    if (result.stdout.trim()) {
        throw new Error(`Immutable Computer release object already exists: ${uri}`);
    }
}

export async function readProductionComputerRelease(url, publicKey, request = fetch) {
    const response = await request(url, { cache: 'no-store' });
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error(`Production Computer descriptor returned ${response.status}.`);
    }
    const descriptor = await response.json();
    verifySignedComputerRelease(descriptor, publicKey);
    return descriptor;
}

export async function verifyPublicObjects(input) {
    const descriptor = await verifyPublicDescriptor(
        `${input.releaseBaseUrl}/${input.version}/release.json`,
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

export function promoteLatest(descriptorPath, s3Root) {
    run('aws', [
        's3',
        'cp',
        descriptorPath,
        `${s3Root}/computer/latest.json`,
        '--cache-control',
        'no-cache',
    ]);
}

export async function promoteInstaller(installerPath, input) {
    run('aws', [
        's3',
        'cp',
        installerPath,
        `${input.s3Root}/computer/install.sh`,
        '--cache-control',
        'no-cache',
        '--content-type',
        'text/x-shellscript',
    ]);
    const expected = await readFile(installerPath, 'utf8');
    await retryPublicVerification('public Computer installer', async () => {
        const response = await fetch(`${input.releaseBaseUrl}/install.sh`, {
            cache: 'no-store',
        });
        if (!response.ok || (await response.text()) !== expected) {
            throw new Error(response.ok ? 'content differs' : `returned ${response.status}`);
        }
    });
}

export async function verifyPublicDescriptor(url, expected, publicKey) {
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

function run(command, args) {
    execFileSync(command, args, { cwd: repoRoot, env: process.env, stdio: 'inherit' });
}
