import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let probeServer: ReturnType<typeof Bun.serve>;

beforeAll(() => {
    probeServer = Bun.serve({
        port: 0,
        fetch(request) {
            const pathname = new URL(request.url).pathname;

            if (pathname === '/server') {
                return Response.json(
                    { code: 'postgres_unavailable', status: 'unhealthy' },
                    { status: 503 }
                );
            }
            if (
                pathname === '/healthy-server' ||
                pathname === '/healthy-public' ||
                pathname === '/healthy-tunnel'
            ) {
                return Response.json({ status: 'ok' });
            }

            return new Response('unavailable', { status: 503 });
        },
    });
});

afterAll(() => {
    probeServer.stop(true);
});

test('classifies component failures without printing probe or alert URLs', async () => {
    const origin = `http://127.0.0.1:${probeServer.port}`;
    const secretMarker = 'must-not-appear';
    const monitor = Bun.spawn(['/usr/bin/env', 'bun', 'src/grotto-server-monitor.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
            ...process.env,
            GROTTO_HEALTH_PUBLIC_URL: `${origin}/public?token=${secretMarker}`,
            GROTTO_HEALTH_PUBLIC_PING_URL: `${origin}/ping/${secretMarker}`,
            GROTTO_HEALTH_SERVER_URL: `${origin}/server?token=${secretMarker}`,
            GROTTO_HEALTH_TUNNEL_URL: `${origin}/tunnel?token=${secretMarker}`,
            GROTTO_HEALTH_POSTGRES_DATABASE: 'grotto_test',
            GROTTO_HEALTH_POSTGRES_HOST: '127.0.0.1',
            GROTTO_HEALTH_POSTGRES_PORT: '5438',
            GROTTO_BACKUP_SUCCESS_FILE: `${origin}/not-a-file`,
            GROTTO_PG_ISREADY_COMMAND: '/usr/bin/false',
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        monitor.exited,
        new Response(monitor.stdout).text(),
        new Response(monitor.stderr).text(),
    ]);

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout)).toEqual({
        codes: [
            'postgres_unavailable',
            'tunnel_unavailable',
            'public_route_unavailable',
            'backup_stale',
        ],
        status: 'unhealthy',
    });
    expect(`${stdout}${stderr}`).not.toContain(secretMarker);
});

test('probes the explicitly configured PostgreSQL endpoint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-monitor-'));
    const pgIsReady = join(root, 'pg-isready');
    const backupSuccess = join(root, 'latest-success');
    await writeFile(
        pgIsReady,
        [
            '#!/bin/sh',
            'set -e',
            'test "$1" = "--host"',
            'test "$2" = "127.0.0.1"',
            'test "$3" = "--port"',
            'test "$4" = "5438"',
            'test "$5" = "--dbname"',
            'test "$6" = "grotto_production"',
        ].join('\n')
    );
    await chmod(pgIsReady, 0o700);
    await writeFile(backupSuccess, 'ok');

    try {
        const origin = `http://127.0.0.1:${probeServer.port}`;
        const monitor = Bun.spawn(['/usr/bin/env', 'bun', 'src/grotto-server-monitor.ts'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: {
                ...process.env,
                GROTTO_BACKUP_SUCCESS_FILE: backupSuccess,
                GROTTO_HEALTH_POSTGRES_DATABASE: 'grotto_production',
                GROTTO_HEALTH_POSTGRES_HOST: '127.0.0.1',
                GROTTO_HEALTH_POSTGRES_PORT: '5438',
                GROTTO_HEALTH_PUBLIC_URL: `${origin}/healthy-public`,
                GROTTO_HEALTH_SERVER_URL: `${origin}/healthy-server`,
                GROTTO_HEALTH_TUNNEL_URL: `${origin}/healthy-tunnel`,
                GROTTO_PG_ISREADY_COMMAND: pgIsReady,
            },
            stderr: 'pipe',
            stdout: 'pipe',
        });
        const [exitCode, stdout] = await Promise.all([
            monitor.exited,
            new Response(monitor.stdout).text(),
        ]);

        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual({ status: 'ok' });
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});
