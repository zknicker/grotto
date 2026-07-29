import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
    type AgentRuntimeCapabilityHealth,
    type AgentRuntimeCapabilityHealthId,
    agentRuntimeProtocolVersion,
} from '@tavern/api';

const directory = mkdtempSync(join(tmpdir(), 'tavern-event-sync-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const [
    { ensureDatabaseSchema },
    { applyObservedAgentRuntimeEvent },
    connectionService,
    { listReachableAgentRuntimeConnections },
    { subscribeToTavernEvent, tavernEventNames },
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('./event-sync.ts'),
    import('../agent-runtime-connection/service.ts'),
    import('../storage/agent-runtime-connections.ts'),
    import('../api/invalidation-events.ts'),
]);

ensureDatabaseSchema();

let runtimeCapabilityStates: Record<string, AgentRuntimeCapabilityHealth['state']> = {};

const runtimeServer = Bun.serve({
    fetch(request) {
        if (new URL(request.url).pathname === '/capabilities') {
            return Response.json(buildCapabilitySnapshot(runtimeCapabilityStates));
        }
        return new Response('not found', { status: 404 });
    },
    hostname: '127.0.0.1',
    port: 0,
});

test.after(() => {
    runtimeServer.stop(true);
});

test('runtime.update refreshes Runtime update status without polling', async () => {
    const controller = new AbortController();
    const updates = subscribeToTavernEvent(tavernEventNames.agentRuntimeUpdated, controller.signal);
    const next = updates.next();

    await applyObservedAgentRuntimeEvent({
        timestamp: new Date().toISOString(),
        type: 'runtime.update',
    });

    assert.ok((await next).value);
    controller.abort();
});

test('reminder.updated refreshes reminder lists without polling', async () => {
    const controller = new AbortController();
    const updates = subscribeToTavernEvent(tavernEventNames.remindersUpdated, controller.signal);
    const next = updates.next();

    await applyObservedAgentRuntimeEvent({
        timestamp: new Date().toISOString(),
        type: 'reminder.updated',
    });

    assert.ok((await next).value);
    controller.abort();
});

test('capability.updated refreshes the cached runtime capability snapshot', async () => {
    process.env.TAVERN_RUNTIME_URL = `http://127.0.0.1:${runtimeServer.port}`;

    // Connect while the runtime still reports its engine checks as warming.
    // The first confirm seeds the environment record; the second mirrors the
    // post-subscribe confirm at boot, which caches the capability snapshot.
    runtimeCapabilityStates = {
        apiServer: 'unavailable',
        gateway: 'unavailable',
    };
    assert.equal(await connectionService.confirmAgentRuntimeConnection(), true);
    assert.equal(await connectionService.confirmAgentRuntimeConnection(), true);

    // The runtime flips healthy after the server cached the warming snapshot.
    runtimeCapabilityStates = { apiServer: 'healthy', gateway: 'healthy' };
    const stale = await connectionService.getAgentRuntimeConnection({
        refreshStatus: false,
    });
    assert.equal(capabilityState(stale, 'gateway'), 'unavailable');

    const [connection] = await listReachableAgentRuntimeConnections();
    assert.ok(connection, 'environment runtime connection record should be reachable');
    await applyObservedAgentRuntimeEvent(
        {
            capability: 'gateway',
            timestamp: new Date().toISOString(),
            type: 'capability.updated',
        },
        connection
    );

    const refreshed = await connectionService.getAgentRuntimeConnection({
        refreshStatus: false,
    });
    assert.equal(capabilityState(refreshed, 'gateway'), 'healthy');
    assert.equal(capabilityState(refreshed, 'apiServer'), 'healthy');
});

function capabilityState(
    connection: Awaited<ReturnType<typeof connectionService.getAgentRuntimeConnection>>,
    capability: string
) {
    return connection?.runtimeCapabilities.find((status) => status.capability === capability)
        ?.state;
}

function buildCapabilitySnapshot(states: Record<string, AgentRuntimeCapabilityHealth['state']>) {
    const timestamp = new Date().toISOString();
    return {
        capabilities: Object.entries(states).map(([id, state]) => ({
            checkedAt: timestamp,
            displayName: id,
            healthy: state === 'healthy',
            id: id as AgentRuntimeCapabilityHealthId,
            lastHealthyAt: state === 'healthy' ? timestamp : null,
            metadata: {},
            nextCheckAt: null,
            reason: state === 'healthy' ? null : 'The capability is warming up.',
            state,
            technicalMessage: null,
            updatedAt: timestamp,
        })),
        health: { ok: true, status: 'healthy', timestamp },
        info: {
            agentRuntimeId: 'tavern-agent-engine',
            name: 'Tavern Runtime',
            protocolVersion: agentRuntimeProtocolVersion,
            version: '1.0.0',
        },
    };
}
