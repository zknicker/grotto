import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computerProtocolVersion } from '@tavern/api';
import type { ServerWebSocket } from 'bun';
import { computerVersion } from './build-identity.ts';
import { launchdPlist, recoverInterruptedUpdate } from './index.ts';
import { progress, readUpdateProgress, writeUpdateProgress } from './update.ts';

const entrypoint = fileURLToPath(new URL('./index.ts', import.meta.url));

test('setup stores only a Server credential and reruns by validation', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const browserBin = join(dataRoot, 'browser-bin');
    const browserMarker = join(dataRoot, 'browser-opened.txt');
    await mkdir(browserBin, { recursive: true });
    await writeFile(
        join(browserBin, 'open'),
        '#!/bin/sh\nprintf \'%s\' "$1" > "$GROTTO_BROWSER_OPEN_MARKER"\n',
        { mode: 0o755 }
    );
    const effectiveAgentRoot = join(dataRoot, 'servers', 'srv_test', 'agents', 'agt_effective');
    await mkdir(effectiveAgentRoot, { recursive: true });
    await writeFile(
        join(effectiveAgentRoot, 'session.json'),
        JSON.stringify({
            effectiveModel: { modelId: 'gpt-5.6-sol', runtimeId: 'codex' },
            generation: 1,
            resumeState: null,
            runtimeSessionId: 'runtime-session',
        })
    );
    const requests: string[] = [];
    const socketFrames: unknown[] = [];
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
                return Response.json({
                    computerId: 'cmp_1234567890123456',
                    status: 'approved',
                });
            }
            if (url.pathname === '/computer/validate') {
                return Response.json({ id: 'cmp_1234567890123456' });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket, message) {
                socketFrames.push(JSON.parse(String(message)));
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    try {
        const environment = {
            ...process.env,
            GROTTO_BROWSER_OPEN_MARKER: browserMarker,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: `http://127.0.0.1:${peer.port}`,
            PATH: `${browserBin}:${process.env.PATH ?? ''}`,
        };
        await runCli(environment);
        expect(await waitForFile(browserMarker)).toBe(
            `http://127.0.0.1:${peer.port}/computer/approve?approval=cap_1234567890123456&secret=${'s'.repeat(32)}`
        );
        const attachmentRoot = join(dataRoot, 'servers', 'srv_test');
        const attachmentPath = join(dataRoot, 'servers', 'srv_test', 'attachment.json');
        const attachment = JSON.parse(await readFile(attachmentPath, 'utf8')) as Record<
            string,
            string
        >;
        expect(attachment).toMatchObject({
            computerId: 'cmp_1234567890123456',
            serverOrigin: `http://127.0.0.1:${peer.port}`,
            serverId: 'srv_test',
            slug: 'hq',
        });
        expect(attachment.credential).toHaveLength(43);
        expect((await stat(attachmentPath)).mode & 0o777).toBe(0o600);
        expect(socketFrames[0]).toMatchObject({
            bootstrapProtocolVersion: 1,
            productVersion: computerVersion,
            protocolVersion: computerProtocolVersion,
            type: 'bootstrap',
            update: { phase: 'idle' },
        });
        expect(socketFrames[0]).not.toHaveProperty('name');
        const reportFrame = socketFrames.find(
            (frame) =>
                typeof frame === 'object' &&
                frame !== null &&
                'type' in frame &&
                frame.type === 'report'
        );
        expect(reportFrame).toMatchObject({
            agents: [
                {
                    agentId: 'agt_effective',
                    missingResources: [],
                    modelId: 'gpt-5.6-sol',
                    runtimeId: 'codex',
                },
            ],
            inventory: { name: expect.any(String) },
            type: 'report',
        });

        await writeFile(
            join(attachmentRoot, 'terminal-unlinked.json'),
            JSON.stringify({
                computerId: attachment.computerId,
                reason: 'computer_machine_unlinked',
            })
        );
        await runCli(environment);
        expect(
            await stat(join(attachmentRoot, 'terminal-unlinked.json')).catch(() => null)
        ).toBeNull();
        expect(requests.filter((request) => request === 'POST /computer/setup')).toHaveLength(1);
        expect(requests.filter((request) => request === 'POST /computer/validate')).toHaveLength(3);
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('setup preserves an unlinked attachment when replacement approval fails', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const serverId = 'srv_oldoldoldoldold1';
    const attachmentRoot = join(dataRoot, 'servers', serverId);
    await mkdir(attachmentRoot, { recursive: true });
    const peer = Bun.serve({
        fetch(request) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/validate') {
                return Response.json(
                    {
                        code: 'computer_machine_unlinked',
                        error: 'Computer credential was rejected.',
                    },
                    { status: 403 }
                );
            }
            if (url.pathname === '/computer/setup') {
                return Response.json({
                    approvalId: 'cap_1234567890123456',
                    approvalUrl: `${url.origin}/computer/approve?approval=cap_1234567890123456&secret=${'s'.repeat(32)}`,
                    serverId: 'srv_newnewnewnewnew1',
                });
            }
            if (url.pathname === '/computer/setup/cap_1234567890123456') {
                return Response.json({ error: 'Computer approval was rejected.' }, { status: 403 });
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
    });
    await writeFile(
        join(attachmentRoot, 'attachment.json'),
        JSON.stringify({
            computerId: 'cmp_oldoldoldoldold1',
            credential: 'old-credential',
            serverId,
            serverOrigin: `http://127.0.0.1:${peer.port}`,
            slug: 'hq',
        })
    );
    try {
        const child = Bun.spawn(['bun', entrypoint, 'setup', '/hq'], {
            env: {
                ...process.env,
                GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
                GROTTO_COMPUTER_DATA_ROOT: dataRoot,
                GROTTO_SERVER_ORIGIN: `http://127.0.0.1:${peer.port}`,
            },
            stderr: 'pipe',
            stdout: 'pipe',
        });
        const stdout = new Response(child.stdout).text();
        expect(await child.exited).toBe(1);
        expect(await stdout).toContain('Open the URL above in a browser to continue.');
        expect(await stdout).not.toContain('press Enter');
        expect(await stat(join(attachmentRoot, 'attachment.json'))).not.toBeNull();
        expect((await readdir(attachmentRoot)).some((file) => file.includes('.unlinked-'))).toBe(
            false
        );
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('setup archives an unlinked attachment before connecting a recreated Server', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const oldServerId = 'srv_oldoldoldoldold1';
    const newServerId = 'srv_newnewnewnewnew1';
    const oldRoot = join(dataRoot, 'servers', oldServerId);
    await mkdir(oldRoot, { recursive: true });
    await writeFile(
        join(oldRoot, 'attachment.json'),
        JSON.stringify({
            computerId: 'cmp_oldoldoldoldold1',
            credential: 'old-credential',
            serverId: oldServerId,
            serverOrigin: 'placeholder',
            slug: 'hq',
        })
    );
    const peer = Bun.serve({
        fetch(request, server) {
            const url = new URL(request.url);
            if (url.pathname === '/computer/validate') {
                return request.json().then((body) =>
                    (body as { serverId?: string }).serverId === oldServerId
                        ? Response.json(
                              {
                                  code: 'computer_machine_unlinked',
                                  error: 'Computer credential was rejected.',
                              },
                              { status: 403 }
                          )
                        : Response.json({ id: 'cmp_newnewnewnewnew1' })
                );
            }
            if (url.pathname === '/computer/setup' && request.method === 'POST') {
                return Response.json({
                    approvalId: 'cap_1234567890123456',
                    approvalUrl: `${url.origin}/computer/approve?approval=cap_1234567890123456&secret=${'s'.repeat(32)}`,
                    serverId: newServerId,
                });
            }
            if (url.pathname === '/computer/setup/cap_1234567890123456') {
                return Response.json({
                    computerId: 'cmp_newnewnewnewnew1',
                    status: 'approved',
                });
            }
            if (url.pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket) {
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
            },
        },
    });
    try {
        await writeFile(
            join(oldRoot, 'attachment.json'),
            JSON.stringify({
                computerId: 'cmp_oldoldoldoldold1',
                credential: 'old-credential',
                serverId: oldServerId,
                serverOrigin: `http://127.0.0.1:${peer.port}`,
                slug: 'hq',
            })
        );
        await runCli({
            ...process.env,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: `http://127.0.0.1:${peer.port}`,
        });

        const oldFiles = await readdir(oldRoot);
        expect(oldFiles).not.toContain('attachment.json');
        expect(
            oldFiles.some((file) =>
                /^attachment\.json\.unlinked-[0-9]+-[a-f0-9]{8}\.bak$/u.test(file)
            )
        ).toBe(true);
        expect(
            JSON.parse(
                await readFile(join(dataRoot, 'servers', newServerId, 'attachment.json'), 'utf8')
            )
        ).toMatchObject({
            computerId: 'cmp_newnewnewnewnew1',
            serverId: newServerId,
            slug: 'hq',
        });
    } finally {
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 15_000);

test('resident start parks a terminally unlinked attachment instead of retrying', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const serverId = 'srv_oldoldoldoldold1';
    const attachmentRoot = join(dataRoot, 'servers', serverId);
    await mkdir(attachmentRoot, { recursive: true });
    let validations = 0;
    const rejected = Promise.withResolvers<void>();
    const peer = Bun.serve({
        fetch(request) {
            if (new URL(request.url).pathname === '/computer/validate') {
                validations += 1;
                rejected.resolve();
                return Response.json(
                    {
                        code: 'computer_machine_unlinked',
                        error: 'Computer credential was rejected.',
                    },
                    { status: 403 }
                );
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
    });
    await writeFile(
        join(attachmentRoot, 'attachment.json'),
        JSON.stringify({
            computerId: 'cmp_oldoldoldoldold1',
            credential: 'old-credential',
            serverId,
            serverOrigin: `http://127.0.0.1:${peer.port}`,
            slug: 'hq',
        })
    );
    const child = Bun.spawn(['bun', entrypoint, 'start'], {
        env: {
            ...process.env,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_RESIDENT: '1',
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    try {
        await rejected.promise;
        await Bun.sleep(1200);
        expect(validations).toBe(1);
        expect(
            JSON.parse(await readFile(join(attachmentRoot, 'terminal-unlinked.json'), 'utf8'))
        ).toMatchObject({
            computerId: 'cmp_oldoldoldoldold1',
            reason: 'computer_machine_unlinked',
            statusCode: 403,
        });
    } finally {
        child.kill();
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
}, 5000);

test('run keeps the attachment connected until the Server closes it', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const connected = Promise.withResolvers<void>();
    const sockets = new Set<ServerWebSocket<undefined>>();
    const peer = Bun.serve({
        fetch(request, server) {
            const pathname = new URL(request.url).pathname;
            if (pathname === '/computer/validate') {
                return Response.json({ valid: true });
            }
            if (pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket, message) {
                sockets.add(socket);
                const frame = JSON.parse(String(message)) as { type?: string };
                if (frame.type === 'bootstrap') {
                    socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
                    connected.resolve();
                }
            },
        },
    });
    const serverId = 'srv_test';
    const attachmentRoot = join(dataRoot, 'servers', serverId);
    await mkdir(attachmentRoot, { recursive: true });
    await writeFile(
        join(attachmentRoot, 'attachment.json'),
        JSON.stringify({
            computerId: 'cmp_1234567890123456',
            credential: 'credential',
            serverId,
            serverOrigin: `http://127.0.0.1:${peer.port}`,
            slug: 'hq',
        })
    );
    const child = Bun.spawn(['bun', entrypoint, 'run', serverId], {
        env: { ...process.env, GROTTO_COMPUTER_DATA_ROOT: dataRoot },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    try {
        await Promise.race([
            connected.promise,
            child.exited.then(async (code) => {
                throw new Error(
                    `Computer exited ${code} before connecting: ${await new Response(child.stderr).text()}`
                );
            }),
        ]);
        await Bun.sleep(50);
        expect(child.exitCode).toBeNull();
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        child.kill();
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('resident start reconnects an attachment after the Server closes it', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    const reconnected = Promise.withResolvers<void>();
    const sockets = new Set<ServerWebSocket<undefined>>();
    let connections = 0;
    const peer = Bun.serve({
        fetch(request, server) {
            const pathname = new URL(request.url).pathname;
            if (pathname === '/computer/validate') {
                return Response.json({ valid: true });
            }
            if (pathname === '/computer/attachment' && server.upgrade(request)) {
                return;
            }
            return new Response('missing', { status: 404 });
        },
        port: 0,
        websocket: {
            message(socket, message) {
                sockets.add(socket);
                const frame = JSON.parse(String(message)) as { type?: string };
                if (frame.type !== 'bootstrap') {
                    return;
                }
                connections += 1;
                socket.send(JSON.stringify({ mode: 'ordinary', type: 'bootstrap-accepted' }));
                if (connections === 1) {
                    setTimeout(() => socket.terminate(), 10);
                } else {
                    reconnected.resolve();
                }
            },
        },
    });
    const serverId = 'srv_test';
    const attachmentRoot = join(dataRoot, 'servers', serverId);
    await mkdir(attachmentRoot, { recursive: true });
    await writeFile(
        join(attachmentRoot, 'attachment.json'),
        JSON.stringify({
            computerId: 'cmp_1234567890123456',
            credential: 'credential',
            serverId,
            serverOrigin: `http://127.0.0.1:${peer.port}`,
            slug: 'hq',
        })
    );
    const child = Bun.spawn(['bun', entrypoint, 'start'], {
        env: {
            ...process.env,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_RESIDENT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    try {
        await Promise.race([
            reconnected.promise,
            Bun.sleep(5000).then(async () => {
                const marker = await readFile(join(attachmentRoot, 'runner.pid'), 'utf8').catch(
                    () => 'missing'
                );
                throw new Error(
                    `Computer did not reconnect after the Server closed its socket. Runner: ${marker}`
                );
            }),
        ]);
        expect(connections).toBe(2);
    } finally {
        for (const socket of sockets) {
            socket.close();
        }
        child.kill();
        peer.stop(true);
        await rm(dataRoot, { force: true, recursive: true });
    }
});

test('the resident service keeps its state root outside executable code', () => {
    const plist = launchdPlist({
        args: ['/opt/grotto/package/index.ts'],
        executable: '/opt/grotto/bin/bun',
    });
    expect(plist).toContain('<string>com.grotto.computer</string>');
    expect(plist).toContain('<key>GROTTO_COMPUTER_DATA_ROOT</key>');
    expect(plist).toContain('.grotto/computer');
    expect(plist).toContain('<key>StandardOutPath</key>');
    expect(plist).toContain('.grotto/computer/logs/computer.log');
    expect(plist).toContain('<key>PATH</key>');
    expect(plist).toContain('/opt/homebrew/bin');
    expect(plist).toContain('/usr/local/bin');
    expect(plist).toContain('/.local/bin');
    expect(plist).not.toContain('/opt/grotto/package/.grotto');
});

test('startup reopens admission after an interrupted update', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-computer-test-'));
    try {
        await writeUpdateProgress(
            dataRoot,
            progress('waiting-for-agents', '1.1.0', 'Waiting for active Agents.')
        );
        await recoverInterruptedUpdate(dataRoot);
        expect(await readUpdateProgress(dataRoot)).toMatchObject({
            detail: expect.stringContaining('interrupted'),
            failedPhase: 'waiting-for-agents',
            phase: 'failed',
            targetVersion: '1.1.0',
        });
    } finally {
        await rm(dataRoot, { force: true, recursive: true });
    }
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

async function waitForFile(path: string): Promise<string> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            return await readFile(path, 'utf8');
        } catch {
            await Bun.sleep(10);
        }
    }
    throw new Error(`Timed out waiting for ${path}.`);
}
