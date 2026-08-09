import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entrypoint = fileURLToPath(new URL('./index.ts', import.meta.url));

interface StoredSession {
    accessToken: string;
    accessTokenExpiresAt: string;
    origin: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
}

test('logout revokes only the human session, stops the service, and preserves attachments and workspaces', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-logout-'));
    const session: StoredSession = {
        accessToken: `gcl_at_${'f'.repeat(43)}`,
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        origin: 'https://server.example.test',
        refreshToken: `gcl_rt_${'g'.repeat(43)}`,
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        sessionId: 'cls_1234567890123456',
    };
    const workspace = join(
        dataRoot,
        'servers',
        'srv_logout',
        'agents',
        'agt_logout',
        'workspace',
        'MEMORY.md'
    );
    const received: unknown[] = [];
    const peer = Bun.serve({
        async fetch(request) {
            if (new URL(request.url).pathname === '/computer/login/revoke') {
                received.push(await request.json());
                return Response.json({ status: 'revoked' });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
    });
    session.origin = `http://127.0.0.1:${peer.port}`;
    try {
        await writeSession(dataRoot, session);
        await mkdir(join(dataRoot, 'servers', 'srv_logout'), { mode: 0o700, recursive: true });
        await writeFile(
            join(dataRoot, 'servers', 'srv_logout', 'attachment.json'),
            `${JSON.stringify({
                computerId: 'cmp_1234567890123456',
                credential: `credential-${'h'.repeat(32)}`,
                serverId: 'srv_logout',
                serverOrigin: session.origin,
                slug: 'hq',
            })}\n`,
            { mode: 0o600 }
        );
        await mkdir(dirname(workspace), { mode: 0o700, recursive: true });
        await writeFile(workspace, 'keep this Agent workspace\n');

        const result = await runCli(['logout'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_SERVER_ORIGIN: session.origin,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain('Grotto Computer logged out.');
        expect(received).toEqual([
            {
                refreshToken: session.refreshToken,
                sessionId: session.sessionId,
            },
        ]);
        await expect(stat(join(dataRoot, 'login.json'))).rejects.toThrow();
        await expect(readFile(workspace, 'utf8')).resolves.toBe('keep this Agent workspace\n');
        await expect(
            stat(join(dataRoot, 'servers', 'srv_logout', 'attachment.json'))
        ).resolves.toBeTruthy();
        await expect(stat(join(dataRoot, 'stopped'))).resolves.toBeTruthy();
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('logout still removes the local session and stops when Server revocation fails', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-logout-failure-'));
    const peer = Bun.serve({
        fetch(request) {
            if (new URL(request.url).pathname === '/computer/login/revoke') {
                return Response.json({ error: 'temporary revocation failure' }, { status: 503 });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
    });
    const session: StoredSession = {
        accessToken: `gcl_at_${'t'.repeat(43)}`,
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        origin: `http://127.0.0.1:${peer.port}`,
        refreshToken: `gcl_rt_${'u'.repeat(43)}`,
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        sessionId: 'cls_1234567890123456',
    };
    try {
        await writeSession(dataRoot, session);
        const result = await runCli(['logout'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_SERVER_ORIGIN: session.origin,
        });

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('logged out locally');
        expect(result.stderr).toContain('temporary revocation failure');
        await expect(stat(join(dataRoot, 'login.json'))).rejects.toThrow();
        await expect(stat(join(dataRoot, 'stopped'))).resolves.toBeTruthy();
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

async function writeSession(dataRoot: string, session: StoredSession) {
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    await writeFile(join(dataRoot, 'login.json'), `${JSON.stringify(session)}\n`, { mode: 0o600 });
}

async function runCli(args: string[], environment: Record<string, string>) {
    const child = Bun.spawn(['bun', entrypoint, ...args], {
        env: { ...process.env, ...environment },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
    ]);
    return { exitCode, stderr, stdout };
}
