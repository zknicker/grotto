import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchdPlist } from './index.ts';

const entrypoint = fileURLToPath(new URL('./index.ts', import.meta.url));

test('setup stores only a Server credential and reruns by validation', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const requests: string[] = [];
    const peer = Bun.serve({
        fetch(request, server) {
            const url = new URL(request.url);
            requests.push(`${request.method} ${url.pathname}`);
            if (url.pathname === '/computer/attachment') {
                if (server.upgrade(request)) {
                    return;
                }
                return new Response('upgrade failed', { status: 500 });
            }
            if (url.pathname === '/computer/setup' && request.method === 'POST') {
                return Response.json({
                    approvalId: 'cap_1234567890123456',
                    approvalUrl: `${url.origin}/computer/approve?approval=cap_1234567890123456&secret=${'s'.repeat(32)}`,
                    serverId: 'srv_test',
                });
            }
            if (url.pathname === '/computer/setup/cap_1234567890123456') {
                return Response.json({ computerId: 'cmp_1234567890123456', status: 'approved' });
            }
            if (url.pathname === '/computer/validate') {
                return Response.json({ id: 'cmp_1234567890123456' });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                socket.send(JSON.stringify({ type: 'accepted' }));
            },
        },
    });
    try {
        const environment = {
            ...process.env,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_SERVER_ORIGIN: `http://127.0.0.1:${peer.port}`,
        };
        await runCli(environment);
        const attachmentPath = join(dataRoot, 'servers', 'srv_test', 'attachment.json');
        const attachment = JSON.parse(await readFile(attachmentPath, 'utf8')) as Record<
            string,
            string
        >;
        expect(attachment).toMatchObject({
            computerId: 'cmp_1234567890123456',
            serverId: 'srv_test',
            slug: 'hq',
        });
        expect(attachment.credential).toHaveLength(43);
        expect((await stat(attachmentPath)).mode & 0o777).toBe(0o600);

        await runCli(environment);
        expect(requests.filter((request) => request === 'POST /computer/setup')).toHaveLength(1);
        expect(requests.filter((request) => request === 'POST /computer/validate')).toHaveLength(1);
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('the resident service keeps its state root outside executable code', () => {
    const plist = launchdPlist('/opt/grotto/bin/bun', '/opt/grotto/package/index.ts');
    expect(plist).toContain('<string>com.grotto.computer</string>');
    expect(plist).toContain('<key>GROTTO_COMPUTER_DATA_ROOT</key>');
    expect(plist).toContain('.grotto/computer');
    expect(plist).not.toContain('/opt/grotto/package/.grotto');
});

async function runCli(environment: Record<string, string | undefined>) {
    const child = Bun.spawn(['bun', entrypoint, 'setup', '/hq'], {
        env: environment,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const exitCode = await child.exited;
    expect(exitCode, await new Response(child.stderr).text()).toBe(0);
}
