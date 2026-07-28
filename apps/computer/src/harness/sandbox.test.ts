import { afterEach, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    const homeDir = join(root, 'agent-home');
    await mkdir(join(hostHomeDir, '.codex'), { recursive: true });
    await mkdir(join(hostHomeDir, '.claude'), { recursive: true });
    await mkdir(join(hostHomeDir, '.pi'), { recursive: true });
    await writeFile(join(hostHomeDir, '.codex', 'auth.json'), '{"token":"codex-one"}');
    await writeFile(join(hostHomeDir, '.claude.json'), '{"token":"claude-one"}');
    await writeFile(join(hostHomeDir, '.claude', '.credentials.json'), '{"oauth":"one"}');
    await writeFile(join(hostHomeDir, '.pi', 'auth.json'), '{"token":"pi-one"}');

    const provider = createLocalTrustedSandboxProvider({
        authProfiles: ['codex', 'claude-code', 'pi'],
        homeDir,
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
    ];
    for (const reference of references) {
        expect((await lstat(reference)).isSymbolicLink()).toBe(true);
    }

    await writeFile(join(hostHomeDir, '.codex', 'auth.json'), '{"token":"codex-two"}');
    expect(await readFile(join(homeDir, '.codex', 'auth.json'), 'utf8')).toContain('codex-two');
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
