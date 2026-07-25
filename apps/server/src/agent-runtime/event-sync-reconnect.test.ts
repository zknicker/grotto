import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    type AgentRuntimeCapabilityHealth,
    type AgentRuntimeEvent,
    agentRuntimeProtocolVersion,
    agentRuntimeRoutes,
} from '@tavern/api';

const directory = mkdtempSync(join(tmpdir(), 'tavern-event-sync-reconnect-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const [
    { ensureDatabaseSchema },
    { startAgentRuntimeEventSync },
    { subscribeToObservedAgentRuntimeEvents },
    { subscribeToTavernEvent, tavernEventNames },
    connectionService,
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('./event-sync.ts'),
    import('./events.ts'),
    import('../api/invalidation-events.ts'),
    import('../agent-runtime-connection/service.ts'),
]);

ensureDatabaseSchema();

// Reconnect-refetch (specs/raft-alignment/README.md, "Transport topology
// (decided)"): when the runtime event socket drops, the server re-connects
// and backfills missed DURABLE events from the catch-up route; volatile
// compositions live only on the socket and are never replayed. WS6 turns
// this in-process hop into a network hop with the same contract.

// Durable events the fake runtime's catch-up route serves. Volatile
// compositions never appear here — the real runtime's projection excludes
// them structurally (see apps/runtime transport-event-classes tests).
const durableCatchUpLog: AgentRuntimeEvent[] = [];
const sockets = new Set<Bun.ServerWebSocket<unknown>>();
let catchUpFetches = 0;

const fakeRuntime = Bun.serve({
    fetch(request, server) {
        const url = new URL(request.url);
        if (url.pathname === agentRuntimeRoutes.events) {
            if (server.upgrade(request)) {
                return;
            }
            catchUpFetches += 1;
            return Response.json({ events: durableCatchUpLog });
        }
        if (url.pathname === '/capabilities') {
            return Response.json(buildCapabilitySnapshot());
        }
        return new Response('not found', { status: 404 });
    },
    hostname: '127.0.0.1',
    port: 0,
    websocket: {
        close(socket) {
            sockets.delete(socket);
        },
        message() {
            // The server only listens on this stream.
        },
        open(socket) {
            sockets.add(socket);
        },
    },
});

afterAll(() => {
    fakeRuntime.stop(true);
});

test('backfills missed durable events after a dropped socket without replaying volatile ones', async () => {
    process.env.TAVERN_RUNTIME_URL = `http://127.0.0.1:${fakeRuntime.port}`;
    expect(await connectionService.confirmAgentRuntimeConnection()).toBe(true);

    const abort = new AbortController();
    const observed: AgentRuntimeEvent[] = [];
    const chatInvalidations: unknown[] = [];
    void collect(subscribeToObservedAgentRuntimeEvents(abort.signal), observed);
    void collect(
        subscribeToTavernEvent(tavernEventNames.chatUpdated, abort.signal),
        chatInvalidations
    );

    try {
        startAgentRuntimeEventSync();
        const socket = await waitFor(() => [...sockets][0]);
        await waitFor(() => (catchUpFetches >= 1 ? true : undefined));

        // Live leg: a volatile composition pushed over the socket reaches
        // the server's observed stream with its payload intact.
        socket.send(JSON.stringify(compositionEvent('cmp_live_1')));
        await waitFor(() => observed.find((event) => event.type === 'agent.composition'));

        // Drop the transport; a durable message lands while disconnected.
        durableCatchUpLog.push(messageAcceptedEvent('cht_transport', 'msg_missed_1'));
        const invalidationsBeforeDrop = chatInvalidations.length;
        socket.close();

        // The server reconnects on its own and refetches the missed
        // durable event from the catch-up route.
        const recovered = await waitFor(() =>
            observed.find((event) => event.type === 'chat.messageAccepted')
        );
        expect(recovered).toMatchObject({
            chatId: 'cht_transport',
            message: { id: 'msg_missed_1', text: 'missed while offline' },
        });
        await waitFor(() => (sockets.size === 1 ? true : undefined));
        expect(catchUpFetches).toBeGreaterThanOrEqual(2);

        // Durable recovery invalidates chats so clients refetch.
        expect(chatInvalidations.length).toBeGreaterThan(invalidationsBeforeDrop);

        // The volatile composition was live-only: reconnect replayed the
        // durable log, not the composition.
        expect(observed.filter((event) => event.type === 'agent.composition')).toHaveLength(1);
        expect(observed.filter((event) => event.type === 'chat.messageAccepted')).toHaveLength(1);
    } finally {
        abort.abort();
    }
}, 15_000);

async function collect<T>(iterable: AsyncIterable<T>, sink: T[]) {
    try {
        for await (const value of iterable) {
            sink.push(value);
        }
    } catch {
        // Aborting the collector at test end is the expected exit.
    }
}

async function waitFor<T>(probe: () => T | undefined, timeoutMs = 10_000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = probe();
        if (value !== undefined) {
            return value;
        }
        if (Date.now() > deadline) {
            throw new Error('Timed out waiting for the probed transport state.');
        }
        await Bun.sleep(25);
    }
}

function compositionEvent(compositionId: string): AgentRuntimeEvent {
    return {
        agentId: 'agt_otto',
        compositionId,
        state: 'composing',
        target: '#general',
        text: 'drafting a reply',
        timestamp: new Date().toISOString(),
        type: 'agent.composition',
    };
}

function messageAcceptedEvent(chatId: string, messageId: string): AgentRuntimeEvent {
    return {
        chatId,
        message: {
            id: messageId,
            senderId: 'usr_tavern',
            senderName: 'Zach',
            sequence: 1,
            text: 'missed while offline',
            timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        type: 'chat.messageAccepted',
    };
}

function buildCapabilitySnapshot() {
    const timestamp = new Date().toISOString();
    const capability = (id: string): AgentRuntimeCapabilityHealth => ({
        checkedAt: timestamp,
        displayName: id,
        healthy: true,
        id: id as AgentRuntimeCapabilityHealth['id'],
        lastHealthyAt: timestamp,
        metadata: {},
        nextCheckAt: null,
        reason: null,
        state: 'healthy',
        technicalMessage: null,
        updatedAt: timestamp,
    });
    return {
        capabilities: [capability('apiServer'), capability('gateway')],
        health: { ok: true, status: 'healthy', timestamp },
        info: {
            agentRuntimeId: 'tavern-agent-engine',
            name: 'Tavern Runtime',
            protocolVersion: agentRuntimeProtocolVersion,
            version: '1.0.0',
        },
    };
}
