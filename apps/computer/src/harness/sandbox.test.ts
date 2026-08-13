import { afterEach, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalTrustedSandboxProvider } from './sandbox.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('provider credentials remain references to host-native auth, never copies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-sandbox-'));
    roots.push(root);
    const hostHomeDir = join(root, 'host');
    const hostGrokHomeDir = join(root, 'host-grok');
    const homeDir = join(root, 'agent-home');
    await mkdir(join(hostHomeDir, '.codex'), { recursive: true });
    await mkdir(join(hostHomeDir, '.claude'), { recursive: true });
    await mkdir(join(hostHomeDir, '.pi'), { recursive: true });
    await mkdir(hostGrokHomeDir, { recursive: true });
    await writeFile(join(hostHomeDir, '.codex', 'auth.json'), '{"token":"codex-one"}');
    await writeFile(join(hostHomeDir, '.claude.json'), '{"token":"claude-one"}');
    await writeFile(join(hostHomeDir, '.claude', '.credentials.json'), '{"oauth":"one"}');
    await writeFile(join(hostHomeDir, '.pi', 'auth.json'), '{"token":"pi-one"}');
    await writeFile(join(hostGrokHomeDir, 'auth.json'), '{"token":"grok-one"}');

    const provider = createLocalTrustedSandboxProvider({
        authProfiles: ['codex', 'claude-code', 'grok-build', 'pi'],
        homeDir,
        hostGrokHomeDir,
        hostHomeDir,
        rootDir: join(root, 'workspace'),
    });
    const session = await provider.createSession?.();
    if (!session) {
        throw new Error('Sandbox provider did not create a session.');
    }
    await session.destroy?.();

    const references = [
        join(homeDir, '.codex', 'auth.json'),
        join(homeDir, '.claude.json'),
        join(homeDir, '.claude', '.credentials.json'),
        join(homeDir, '.pi', 'auth.json'),
        join(homeDir, '.grok', 'auth.json'),
    ];
    for (const reference of references) {
        expect((await lstat(reference)).isSymbolicLink()).toBe(true);
    }

    await writeFile(join(hostHomeDir, '.codex', 'auth.json'), '{"token":"codex-two"}');
    expect(await readFile(join(homeDir, '.codex', 'auth.json'), 'utf8')).toContain('codex-two');
    expect(await realpath(join(homeDir, '.grok', 'auth.json'))).toBe(
        await realpath(join(hostGrokHomeDir, 'auth.json'))
    );
});

test('sandbox file operations reject another Agent root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-sandbox-boundary-'));
    roots.push(root);
    const workspace = join(root, 'agent-a');
    await mkdir(workspace);
    await writeFile(join(root, 'agent-b-token'), 'secret');
    const session = await createLocalTrustedSandboxProvider({
        rootDir: workspace,
    }).createSession?.();
    if (!session) {
        throw new Error('Sandbox provider did not create a session.');
    }

    await expect(session.readTextFile?.({ path: '../agent-b-token' })).rejects.toThrow(
        'inside this Agent root'
    );
    await expect(session.readTextFile?.({ path: join(root, 'agent-b-token') })).rejects.toThrow(
        'inside this Agent root'
    );
    await session.destroy?.();
});

test('sandbox permits only the shared derived harness bootstrap outside the Agent root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-sandbox-bootstrap-'));
    roots.push(root);
    const session = await createLocalTrustedSandboxProvider({
        rootDir: join(root, 'agent'),
    }).createSession?.();
    if (!session) {
        throw new Error('Sandbox provider did not create a session.');
    }
    const bootstrapDir = join('/tmp/harness', `sandbox-test-${root.split('/').at(-1)}`);
    roots.push(bootstrapDir);

    await expect(
        session.writeTextFile?.({
            content: 'bridge',
            path: join(bootstrapDir, 'bridge.mjs'),
        })
    ).resolves.toBeUndefined();
    await session.writeTextFile?.({
        content: '{"private":true}',
        path: join(bootstrapDir, 'package.json'),
    });
    const canonicalBootstrapDir = await realpath(bootstrapDir);
    await expect(
        session.run?.({
            command: 'test -f package.json && pwd',
            workingDirectory: bootstrapDir,
        })
    ).resolves.toMatchObject({
        exitCode: 0,
        stdout: `${canonicalBootstrapDir}\n`,
    });
    await session.destroy?.();
});
