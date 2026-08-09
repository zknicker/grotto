import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('login reuses a usable access token without opening device authorization', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-login-reuse-'));
    const requests: string[] = [];
    const peer = Bun.serve({
        fetch(request) {
            requests.push(new URL(request.url).pathname);
            return new Response('device authorization must not start', { status: 500 });
        },
        port: 0,
    });
    const session: StoredSession = {
        accessToken: `gcl_at_${'a'.repeat(43)}`,
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        origin: `http://127.0.0.1:${peer.port}`,
        refreshToken: `gcl_rt_${'b'.repeat(43)}`,
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        sessionId: 'cls_1234567890123456',
    };
    try {
        await writeSession(dataRoot, session);
        const result = await runCli(['login'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_SERVER_ORIGIN: session.origin,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain('Reused the saved Grotto Computer login.');
        expect(requests).toEqual([]);
        expect(JSON.parse(await readFile(join(dataRoot, 'login.json'), 'utf8'))).toEqual(session);
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('login rotates an expired access token through the saved refresh session', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-login-refresh-'));
    const received: unknown[] = [];
    const peer = Bun.serve({
        async fetch(request) {
            if (new URL(request.url).pathname === '/computer/login/refresh') {
                received.push(await request.json());
                return Response.json({
                    accessToken: `gcl_at_${'i'.repeat(43)}`,
                    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                    origin: new URL(request.url).origin,
                    refreshToken: `gcl_rt_${'j'.repeat(43)}`,
                    refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
                    sessionId: 'cls_1234567890123456',
                    status: 'refreshed',
                });
            }
            return new Response('device authorization must not start', { status: 500 });
        },
        port: 0,
    });
    const origin = `http://127.0.0.1:${peer.port}`;
    const previous: StoredSession = {
        accessToken: `gcl_at_${'k'.repeat(43)}`,
        accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
        origin,
        refreshToken: `gcl_rt_${'l'.repeat(43)}`,
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        sessionId: 'cls_1234567890123456',
    };
    try {
        await writeSession(dataRoot, previous);
        const result = await runCli(['login'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_SERVER_ORIGIN: origin,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain('Reused the saved Grotto Computer login.');
        expect(received).toEqual([
            {
                refreshToken: previous.refreshToken,
                sessionId: previous.sessionId,
            },
        ]);
        const stored = JSON.parse(await readFile(join(dataRoot, 'login.json'), 'utf8'));
        expect(stored).toMatchObject({
            accessToken: `gcl_at_${'i'.repeat(43)}`,
            refreshToken: `gcl_rt_${'j'.repeat(43)}`,
            sessionId: previous.sessionId,
        });
        expect((await stat(join(dataRoot, 'login.json'))).mode & 0o777).toBe(0o600);
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('login requires explicit replacement before changing the saved origin', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-login-replace-'));
    let polls = 0;
    const peer = Bun.serve({
        async fetch(request) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/login' && request.method === 'POST') {
                return Response.json({
                    deviceCode: 'm'.repeat(43),
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    pollingIntervalMs: 1,
                    userCode: 'ABCD-EFGH',
                    verificationUrl: `${url.origin}/computer/login?code=ABCD-EFGH`,
                });
            }
            if (url.pathname === '/computer/login/poll' && request.method === 'POST') {
                polls += 1;
                return polls === 1
                    ? Response.json({ pollingIntervalMs: 1, status: 'pending' })
                    : Response.json({
                          accessToken: `gcl_at_${'n'.repeat(43)}`,
                          accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                          origin: url.origin,
                          refreshToken: `gcl_rt_${'o'.repeat(43)}`,
                          refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
                          sessionId: 'cls_6543210987654321',
                          status: 'approved',
                      });
            }
            if (url.pathname === '/computer/login/complete' && request.method === 'POST') {
                return Response.json({ status: 'completed' });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
    });
    const replacementOrigin = `http://127.0.0.1:${peer.port}`;
    const previous: StoredSession = {
        accessToken: `gcl_at_${'p'.repeat(43)}`,
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        origin: 'https://old-account.example.test',
        refreshToken: `gcl_rt_${'q'.repeat(43)}`,
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        sessionId: 'cls_1234567890123456',
    };
    try {
        await writeSession(dataRoot, previous);
        const blocked = await runCli(['login'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_SERVER_ORIGIN: replacementOrigin,
        });
        expect(blocked.exitCode).not.toBe(0);
        expect(blocked.stderr).toContain('already signed in to https://old-account.example.test');
        expect(JSON.parse(await readFile(join(dataRoot, 'login.json'), 'utf8'))).toEqual(previous);

        const replaced = await runCli(['login', '--replace'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_SERVER_ORIGIN: replacementOrigin,
        });
        expect(replaced.exitCode, replaced.stderr).toBe(0);
        expect(replaced.stdout).toContain('Grotto Computer signed in.');
        expect(JSON.parse(await readFile(join(dataRoot, 'login.json'), 'utf8'))).toMatchObject({
            origin: replacementOrigin,
            sessionId: 'cls_6543210987654321',
        });
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('status reports the login origin and attached Servers without secrets', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-status-'));
    const origin = 'https://server.example.test';
    const secret = `gcl_at_${'c'.repeat(43)}`;
    try {
        await writeSession(dataRoot, {
            accessToken: secret,
            accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            origin,
            refreshToken: `gcl_rt_${'d'.repeat(43)}`,
            refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            sessionId: 'cls_1234567890123456',
        });
        await mkdir(join(dataRoot, 'servers', 'srv_status'), { mode: 0o700, recursive: true });
        await writeFile(
            join(dataRoot, 'servers', 'srv_status', 'attachment.json'),
            `${JSON.stringify({
                computerId: 'cmp_1234567890123456',
                credential: `gcl_credential_${'e'.repeat(32)}`,
                serverId: 'srv_status',
                serverOrigin: origin,
                slug: 'hq',
            })}\n`,
            { mode: 0o600 }
        );

        const result = await runCli(['status'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain('Login: signed in');
        expect(result.stdout).toContain(`Origin: ${origin}`);
        expect(result.stdout).toContain('/hq: stopped');
        expect(result.stdout).not.toContain(secret);
        expect(result.stdout).not.toContain('gcl_rt_');
    } finally {
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
