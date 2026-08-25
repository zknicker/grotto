import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { computerBootstrapProtocolVersion, computerProtocolVersion } from '@grotto/api';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
const userId = 'usr_reportorder00000';
const serverId = 'srv_reportorder00000';
const computerId = 'cmp_reportorder00000';
const agentId = 'agt_reportorder00000';
const credential = 'computer-report-order-credential';

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    await harness.sql`
        insert into users (id, clerk_user_id)
        values (${userId}, 'clerk_report_order')
    `;
    await harness.sql`
        insert into servers (id, slug, display_name)
        values (${serverId}, 'report-order', 'Report Order')
    `;
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_reportorder00000', ${serverId}, ${userId}, 'owner')
    `;
    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash)
        values (${computerId}, ${serverId}, ${userId}, ${digest(credential)})
    `;
    await harness.sql`
        insert into agents (
            id, server_id, handle, display_name, home_timezone, role,
            computer_id, desired_runtime_id, desired_model_id
        )
        values (
            ${agentId}, ${serverId}, 'report-cove', 'Cove', 'America/New_York', 'member',
            ${computerId}, 'codex', 'gpt-5.6-sol'
        )
    `;
});

afterAll(async () => {
    await harness?.close();
});

test('Computer reports are applied in socket order', async () => {
    const socket = new WebSocket(computerSocketUrl());
    await opened(socket);
    socket.send(JSON.stringify(bootstrapFrame()));
    expect(await message(socket)).toEqual({
        mode: 'ordinary',
        type: 'bootstrap-accepted',
    });

    const staleStates = Array.from({ length: 499 }, (_, index) => ({
        agentId: `agt_${String(index).padStart(16, '0')}`,
        missingResources: ['runtime:stale'],
        modelId: null,
        runtimeId: null,
    }));
    staleStates.push({
        agentId,
        missingResources: ['runtime:stale'],
        modelId: null,
        runtimeId: null,
    });
    socket.send(JSON.stringify({ agents: staleStates, type: 'report' }));
    socket.send(
        JSON.stringify({
            agents: [
                {
                    agentId,
                    missingResources: [],
                    modelId: 'gpt-5.6-sol',
                    runtimeId: 'codex',
                },
            ],
            type: 'report',
        })
    );
    await Bun.sleep(1000);

    const [row] = (await harness.sql`
        select effective_missing, effective_model_id, effective_runtime_id
        from agents
        where id = ${agentId}
    `) as {
        effective_missing: string[];
        effective_model_id: string | null;
        effective_runtime_id: string | null;
    }[];
    expect(row).toEqual({
        effective_missing: [],
        effective_model_id: 'gpt-5.6-sol',
        effective_runtime_id: 'codex',
    });
    socket.close();
});

function bootstrapFrame() {
    return {
        architecture: 'arm64',
        bootstrapProtocolVersion: computerBootstrapProtocolVersion,
        credential,
        health: 'healthy',
        operatingSystem: 'darwin',
        productVersion: '1.1.2',
        protocolVersion: computerProtocolVersion,
        type: 'bootstrap',
        update: {
            detail: 'Grotto Computer updated successfully.',
            phase: 'complete',
            targetVersion: '1.1.2',
            updatedAt: '2026-07-29T16:53:27.328Z',
        },
    };
}

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
