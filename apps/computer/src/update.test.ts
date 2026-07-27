import { expect, test } from 'bun:test';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    admitActiveRun,
    readUpdateProgress,
    runSignedUpdate,
    verifySignedRelease,
} from './update.ts';
import { computerReleaseSigningPayload, type SignedComputerRelease } from './update-contract.ts';

test('a signed update waits without a kill timeout, then installs and restarts', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-update-test-'));
    const tarball = Buffer.from('verified computer tarball');
    const peer = serveTarball(tarball);
    const keys = generateKeyPairSync('ed25519');
    const release = signedRelease(peer.url, tarball, keys.privateKey);
    const clearRun = await admitActiveRun(dataRoot, 'run_active');
    expect(clearRun).not.toBeNull();
    let installed = false;
    let restarted = false;

    try {
        const updating = runSignedUpdate({
            dataRoot,
            install: async (path) => {
                expect(await readFile(path)).toEqual(tarball);
                installed = true;
            },
            publicKey: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
            release,
            restart: async () => {
                restarted = true;
            },
        });

        await waitForPhase(dataRoot, 'waiting-for-agents');
        expect(installed).toBe(false);
        expect(await admitActiveRun(dataRoot, 'run_too_late')).toBeNull();
        await Bun.sleep(300);
        expect(installed).toBe(false);

        await clearRun?.();
        await updating;
        expect(installed).toBe(true);
        expect(restarted).toBe(true);
        expect((await readUpdateProgress(dataRoot)).phase).toBe('restarting');
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('failed signature verification never touches Computer data or installs', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-update-test-'));
    const durablePath = join(dataRoot, 'servers', 'srv_test', 'attachment.json');
    await Bun.write(durablePath, '{"credential":"keep"}\n', { createPath: true });
    const keys = generateKeyPairSync('ed25519');
    const wrongKeys = generateKeyPairSync('ed25519');
    const tarball = Buffer.from('untrusted');
    const release = signedRelease('https://example.test/computer.tgz', tarball, keys.privateKey);
    let installed = false;

    try {
        expect(() =>
            verifySignedRelease(
                release,
                wrongKeys.publicKey.export({ format: 'pem', type: 'spki' }).toString()
            )
        ).toThrow('signature verification failed');
        await expect(
            runSignedUpdate({
                dataRoot,
                install: async () => {
                    installed = true;
                },
                publicKey: wrongKeys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
                release,
                restart: async () => undefined,
            })
        ).rejects.toThrow('signature verification failed');
        expect(installed).toBe(false);
        expect(await readFile(durablePath, 'utf8')).toBe('{"credential":"keep"}\n');
        expect((await readUpdateProgress(dataRoot)).phase).toBe('failed');
    } finally {
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('one physical Computer runs only one update job', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-update-test-'));
    const tarball = Buffer.from('verified computer tarball');
    const peer = serveTarball(tarball);
    const keys = generateKeyPairSync('ed25519');
    const release = signedRelease(peer.url, tarball, keys.privateKey);
    const clearRun = await admitActiveRun(dataRoot, 'run_active');
    let installs = 0;
    let restarts = 0;
    const input = {
        dataRoot,
        install: async () => {
            installs += 1;
        },
        publicKey: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
        release,
        restart: async () => {
            restarts += 1;
        },
    };

    try {
        const first = runSignedUpdate(input);
        await waitForPhase(dataRoot, 'waiting-for-agents');
        await runSignedUpdate(input);
        await clearRun?.();
        await first;
        expect(installs).toBe(1);
        expect(restarts).toBe(1);
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

function serveTarball(bytes: Buffer) {
    const server = Bun.serve({
        fetch: () => new Response(bytes),
        port: 0,
    });
    return {
        stop: (closeActiveConnections: boolean) => server.stop(closeActiveConnections),
        url: `http://127.0.0.1:${server.port}/computer.tgz`,
    };
}

function signedRelease(
    tarballUrl: string,
    bytes: Buffer,
    privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']
): SignedComputerRelease {
    const release = {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        tarballUrl,
        version: '1.1.0',
    };
    return {
        release,
        signature: sign(
            null,
            Buffer.from(computerReleaseSigningPayload(release)),
            privateKey
        ).toString('base64'),
    };
}

async function waitForPhase(
    dataRoot: string,
    phase: Awaited<ReturnType<typeof readUpdateProgress>>['phase']
) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if ((await readUpdateProgress(dataRoot)).phase === phase) {
            return;
        }
        await Bun.sleep(10);
    }
    throw new Error(`Update did not reach ${phase}.`);
}
