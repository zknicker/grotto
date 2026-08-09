import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerWebSocket } from 'bun';

const entrypoint = fileURLToPath(new URL('./index.ts', import.meta.url));

interface StoredSession {
    accessToken: string;
    accessTokenExpiresAt: string;
    origin: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
}

const session: StoredSession = {
    accessToken: `gcl_at_${'a'.repeat(43)}`,
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    origin: '',
    refreshToken: `gcl_rt_${'b'.repeat(43)}`,
    refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    sessionId: 'cls_1234567890123456',
};

test('attach requires an existing usable Computer login and never launches login', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-attach-login-'));
    const requests: string[] = [];
    const peer = Bun.serve({
        fetch(request) {
            requests.push(new URL(request.url).pathname);
            return new Response('login must be supplied first', { status: 500 });
        },
        port: 0,
    });
    try {
        const result = await runCli(['attach', '/hq'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_SERVER_ORIGIN: `http://127.0.0.1:${peer.port}`,
        });

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Grotto Computer is not signed in');
        expect(result.stderr).toContain('grotto-computer login');
        expect(requests).toEqual([]);
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('attach uses the saved login and stores only the Server-scoped credential', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-attach-'));
    const requests: { body?: Record<string, string>; path: string }[] = [];
    const sockets = new Set<ServerWebSocket<undefined>>();
    const peer = Bun.serve({
        async fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            requests.push({
                body:
                    request.method === 'POST'
                        ? ((await request.json()) as Record<string, string>)
                        : undefined,
                path: url.pathname,
            });
            if (url.pathname === '/computer/attach') {
                const body = requests.at(-1)?.body;
                return Response.json({
                    computerId: 'cmp_1234567890123456',
                    idempotent: false,
                    serverId: 'srv_attach_server',
                    slug: body?.slug,
                });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                sockets.add(socket);
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    const origin = `http://127.0.0.1:${peer.port}`;
    try {
        await writeSession(dataRoot, { ...session, origin });
        const result = await runCli(['attach', '/hq'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: origin,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        const attachRequest = requests.find((request) => request.path === '/computer/attach');
        expect(attachRequest?.body).toMatchObject({
            accessToken: session.accessToken,
            slug: 'hq',
        });
        expect(attachRequest?.body?.credentialHash).toMatch(/^[a-f0-9]{64}$/u);
        expect(attachRequest?.body?.idempotencyKey).toMatch(/^cak_[A-Za-z0-9_-]{43}$/u);
        expect(
            requests.map((request) => request.path).filter((path) => path !== '/computer/validate')
        ).toEqual(['/computer/attach']);

        const attachment = JSON.parse(
            await readFile(
                join(dataRoot, 'servers', 'srv_attach_server', 'attachment.json'),
                'utf8'
            )
        ) as Record<string, string>;
        expect(attachment).toMatchObject({
            computerId: 'cmp_1234567890123456',
            serverId: 'srv_attach_server',
            serverOrigin: origin,
            slug: 'hq',
        });
        expect(attachment.credential).toHaveLength(43);
        expect(attachment.credential).not.toBe(session.accessToken);
        expect(attachment).not.toHaveProperty('accessToken');
        expect(
            (await stat(join(dataRoot, 'servers', 'srv_attach_server', 'attachment.json'))).mode &
                0o777
        ).toBe(0o600);
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('setup falls back to device login, persists pending issuance before attach, and starts', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-setup-login-'));
    const requests: string[] = [];
    let pendingAtAttach: Record<string, string> | null = null;
    const sockets = new Set<ServerWebSocket<undefined>>();
    let polls = 0;
    let origin = '';
    const peer = Bun.serve({
        async fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            requests.push(`${request.method} ${url.pathname}`);
            if (url.pathname === '/computer/login') {
                return Response.json({
                    deviceCode: `d${'x'.repeat(42)}`,
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    pollingIntervalMs: 1,
                    userCode: 'ABCD-EFGH',
                    verificationUrl: `${url.origin}/computer/login?code=ABCD-EFGH`,
                });
            }
            if (url.pathname === '/computer/login/poll') {
                polls += 1;
                return polls === 1
                    ? Response.json({ pollingIntervalMs: 1, status: 'pending' })
                    : Response.json({
                          accessToken: session.accessToken,
                          accessTokenExpiresAt: session.accessTokenExpiresAt,
                          origin,
                          refreshToken: session.refreshToken,
                          refreshTokenExpiresAt: session.refreshTokenExpiresAt,
                          sessionId: session.sessionId,
                          status: 'approved',
                      });
            }
            if (url.pathname === '/computer/login/complete') {
                return Response.json({ status: 'completed' });
            }
            if (url.pathname === '/computer/attach') {
                const body = (await request.json()) as { slug: string };
                pendingAtAttach = JSON.parse(
                    await readFile(join(dataRoot, 'pending-attachments', 'hq.json'), 'utf8')
                ) as Record<string, string>;
                return Response.json({
                    computerId: 'cmp_1234567890123456',
                    idempotent: false,
                    serverId: 'srv_setup_server',
                    slug: body.slug,
                });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                sockets.add(socket);
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    origin = `http://127.0.0.1:${peer.port}`;
    try {
        const result = await runCli(['setup', '/hq'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: origin,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(requests.filter((request) => request !== 'POST /computer/validate')).toEqual([
            'POST /computer/login',
            'POST /computer/login/poll',
            'POST /computer/login/poll',
            'POST /computer/login/complete',
            'POST /computer/attach',
        ]);
        expect(pendingAtAttach).toMatchObject({ origin, slug: 'hq' });
        const pending = pendingAtAttach as unknown as Record<string, string>;
        expect(pending.credential).toMatch(/^[A-Za-z0-9_-]{43}$/u);
        expect(pending.idempotencyKey).toMatch(/^cak_[A-Za-z0-9_-]{43}$/u);
        expect(pendingAtAttach).not.toHaveProperty('accessToken');
        await expect(stat(join(dataRoot, 'pending-attachments', 'hq.json'))).rejects.toThrow();
        await expect(
            stat(join(dataRoot, 'servers', 'srv_setup_server', 'attachment.json'))
        ).resolves.toBeTruthy();
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('setup retries a crashed issuance with the same pending idempotency key', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-setup-retry-'));
    const firstAttachStarted = Promise.withResolvers<void>();
    let releaseFirstResponse: ((response: Response) => void) | null = null;
    const requests: Record<string, string>[] = [];
    const sockets = new Set<ServerWebSocket<undefined>>();
    let attachCount = 0;
    const peer = Bun.serve({
        async fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            if (url.pathname === '/computer/attach') {
                const body = (await request.json()) as Record<string, string>;
                requests.push(body);
                attachCount += 1;
                if (attachCount === 1) {
                    firstAttachStarted.resolve();
                    await new Promise<Response>((resolve) => {
                        releaseFirstResponse = resolve;
                    });
                }
                return Response.json({
                    computerId: 'cmp_1234567890123456',
                    idempotent: attachCount > 1,
                    serverId: 'srv_retry_server',
                    slug: body.slug,
                });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                sockets.add(socket);
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    const origin = `http://127.0.0.1:${peer.port}`;
    try {
        await writeSession(dataRoot, { ...session, origin });
        const first = Bun.spawn(['bun', entrypoint, 'setup', '/hq'], {
            env: {
                ...process.env,
                GROTTO_COMPUTER_DATA_ROOT: dataRoot,
                GROTTO_COMPUTER_ONESHOT: '1',
                GROTTO_COMPUTER_USAGE_DISABLED: '1',
                GROTTO_SERVER_ORIGIN: origin,
            },
            stderr: 'pipe',
            stdout: 'pipe',
        });
        await firstAttachStarted.promise;
        const pendingBeforeCrash = JSON.parse(
            await readFile(join(dataRoot, 'pending-attachments', 'hq.json'), 'utf8')
        ) as Record<string, string>;
        first.kill();
        (releaseFirstResponse as ((response: Response) => void) | null)?.(
            Response.json({ status: 'discarded' })
        );
        await first.exited;

        const retry = await runCli(['setup', '/hq'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: origin,
        });

        expect(retry.exitCode, retry.stderr).toBe(0);
        expect(requests).toHaveLength(2);
        expect(requests[1]).toMatchObject({
            credentialHash: requests[0]?.credentialHash,
            idempotencyKey: requests[0]?.idempotencyKey,
            slug: 'hq',
        });
        expect(pendingBeforeCrash.idempotencyKey).toBe(requests[0]?.idempotencyKey);
        await expect(stat(join(dataRoot, 'pending-attachments', 'hq.json'))).rejects.toThrow();
        await expect(
            stat(join(dataRoot, 'servers', 'srv_retry_server', 'attachment.json'))
        ).resolves.toBeTruthy();
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('setup resumes an existing attachment without login or migration', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-setup-existing-'));
    const requests: string[] = [];
    const sockets = new Set<ServerWebSocket<undefined>>();
    const peer = Bun.serve({
        fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            requests.push(url.pathname);
            if (url.pathname === '/computer/validate') {
                return Response.json({ id: 'cmp_existing123456' });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                sockets.add(socket);
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    const origin = `http://127.0.0.1:${peer.port}`;
    try {
        const attachmentRoot = join(dataRoot, 'servers', 'srv_existing_server');
        await mkdir(attachmentRoot, { mode: 0o700, recursive: true });
        await writeFile(
            join(attachmentRoot, 'attachment.json'),
            `${JSON.stringify({
                computerId: 'cmp_existing123456',
                credential: 'existing-credential',
                serverId: 'srv_existing_server',
                serverOrigin: origin,
                slug: 'hq',
            })}\n`,
            { mode: 0o600 }
        );

        const result = await runCli(['setup', '/hq'], {
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: origin,
        });

        expect(result.exitCode, result.stderr).toBe(0);
        expect(requests.length).toBeGreaterThan(0);
        expect(requests.every((path) => path === '/computer/validate')).toBe(true);
        await expect(readFile(join(attachmentRoot, 'attachment.json'), 'utf8')).resolves.toContain(
            'existing-credential'
        );
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('setup adds another Server without replacing the first attachment', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-setup-additive-'));
    const sockets = new Set<ServerWebSocket<undefined>>();
    const attached = new Map([
        ['hq', { computerId: 'cmp_first123456789', serverId: 'srv_first123456789' }],
        ['lab', { computerId: 'cmp_second12345678', serverId: 'srv_second1234567' }],
    ]);
    const peer = Bun.serve({
        async fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            if (url.pathname === '/computer/attach') {
                const body = (await request.json()) as { slug: string };
                const result = attached.get(body.slug);
                return Response.json({
                    computerId: result?.computerId,
                    idempotent: false,
                    serverId: result?.serverId,
                    slug: body.slug,
                });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                sockets.add(socket);
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    const origin = `http://127.0.0.1:${peer.port}`;
    try {
        await writeSession(dataRoot, { ...session, origin });
        for (const slug of ['hq', 'lab']) {
            const result = await runCli(['setup', `/${slug}`], {
                GROTTO_COMPUTER_DATA_ROOT: dataRoot,
                GROTTO_COMPUTER_ONESHOT: '1',
                GROTTO_COMPUTER_USAGE_DISABLED: '1',
                GROTTO_SERVER_ORIGIN: origin,
            });
            expect(result.exitCode, result.stderr).toBe(0);
        }

        await expect(
            stat(join(dataRoot, 'servers', 'srv_first123456789', 'attachment.json'))
        ).resolves.toBeTruthy();
        await expect(
            stat(join(dataRoot, 'servers', 'srv_second1234567', 'attachment.json'))
        ).resolves.toBeTruthy();
        await expect(
            stat(join(dataRoot, 'servers', 'srv_first123456789', 'attachment.json'))
        ).resolves.toBeTruthy();
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

async function writeSession(dataRoot: string, value: StoredSession) {
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    await writeFile(join(dataRoot, 'login.json'), `${JSON.stringify(value)}\n`, { mode: 0o600 });
}

async function runCli(args: string[], environment: Record<string, string | undefined>) {
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
