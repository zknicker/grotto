import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { computerBootstrapProtocolVersion } from '@tavern/api';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
const userId = 'usr_bootstrap0000000';
const serverId = 'srv_bootstrap0000000';
const computerId = 'cmp_bootstrap0000000';
const oldComputerId = 'cmp_oldbootstrap0000';
const credential = 'computer-bootstrap-credential-00000000';
const oldCredential = 'old-computer-bootstrap-credential-000';

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    await harness.sql`
        insert into users (id, clerk_user_id)
        values (${userId}, 'clerk_bootstrap_user')
    `;
    await harness.sql`
        insert into servers (id, slug, display_name)
        values (${serverId}, 'bootstrap-test', 'Bootstrap Test')
    `;
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_bootstrap0000000', ${serverId}, ${userId}, 'owner')
    `;
    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash)
        values
            (${computerId}, ${serverId}, ${userId}, ${digest(credential)}),
            (${oldComputerId}, ${serverId}, ${userId}, ${digest(oldCredential)})
    `;
});

afterAll(async () => {
    await harness?.close();
});

test('incompatible ordinary protocol remains connected only for update progress', async () => {
    const socket = new WebSocket(computerSocketUrl());
    await opened(socket);
    socket.send(
        JSON.stringify({
            architecture: 'arm64',
            bootstrapProtocolVersion: computerBootstrapProtocolVersion,
            credential,
            health: 'healthy',
            operatingSystem: 'darwin',
            productVersion: '0.9.0',
            protocolVersion: 999,
            type: 'bootstrap',
            update: {
                activeAgentCount: null,
                detail: null,
                downloadedBytes: null,
                failedPhase: null,
                phase: 'idle',
                targetVersion: null,
                totalBytes: null,
                updatedAt: '2026-07-27T12:00:00.000Z',
            },
        })
    );

    expect(await message(socket)).toEqual({
        mode: 'update-required',
        type: 'bootstrap-accepted',
    });
    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.send(
        JSON.stringify({
            type: 'update-progress',
            update: {
                activeAgentCount: 2,
                detail: 'Waiting for active Agents to finish.',
                downloadedBytes: null,
                failedPhase: null,
                phase: 'waiting-for-agents',
                targetVersion: '1.1.0',
                totalBytes: null,
                updatedAt: '2026-07-27T12:01:00.000Z',
            },
        })
    );
    await eventually(async () => {
        const rows = (await harness.sql`
            select health, update_phase, update_target_version
            from computers where id = ${computerId}
        `) as { health: string; update_phase: string; update_target_version: string }[];
        expect(rows[0]).toEqual({
            health: 'update-required',
            update_phase: 'waiting-for-agents',
            update_target_version: '1.1.0',
        });
    });
    socket.close();
});

test('a Computer without stable bootstrap fails closed', async () => {
    const socket = new WebSocket(computerSocketUrl());
    await opened(socket);
    socket.send(
        JSON.stringify({
            architecture: 'arm64',
            credential: oldCredential,
            health: 'healthy',
            operatingSystem: 'darwin',
            productVersion: '0.8.0',
            protocolVersion: 1,
            type: 'hello',
        })
    );
    expect(await closed(socket)).toBe(4403);
});

function digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

function computerSocketUrl() {
    const url = new URL('/computer/attachment', harness.url);
    url.protocol = 'ws:';
    return url;
}

function opened(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true });
        socket.addEventListener('error', () => reject(new Error('socket failed')), {
            once: true,
        });
    });
}

function message(socket: WebSocket) {
    return new Promise<unknown>((resolve) => {
        socket.addEventListener('message', (event) => resolve(JSON.parse(String(event.data))), {
            once: true,
        });
    });
}

function closed(socket: WebSocket) {
    return new Promise<number>((resolve) => {
        socket.addEventListener('close', (event) => resolve(event.code), { once: true });
    });
}

async function eventually(assertion: () => Promise<void>) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            await assertion();
            return;
        } catch {
            await Bun.sleep(10);
        }
    }
    await assertion();
}
