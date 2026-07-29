import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import type { HostedAgentCommand, HostedAgentTurnSummary } from '@tavern/api';
import { eq } from 'drizzle-orm';
import { AgentDelivery, type DeliveryTransport } from '../src/agent-delivery/delivery.ts';
import { countQueuedPending, readDeliveryState } from '../src/agent-delivery/store.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createOpaqueId } from '../src/postgres/opaque-id.ts';
import {
    agentDeliveryTable,
    agentPendingWorkTable,
    agentRunnerCredentialsTable,
    agentsTable,
    agentTurnsTable,
    chatsTable,
    computersTable,
    serverMembershipsTable,
    serversTable,
    usersTable,
} from '../src/postgres/schema.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let cluster: PostgresCluster;
let connection: GrottoConnection;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    connection = await connectGrottoDatabase(cluster.databaseUrl);
});

afterAll(async () => {
    await connection?.close();
    await cluster?.stop();
});

/** A Computer wire that records frames only for attached (online) Computers. */
class FakeTransport implements DeliveryTransport {
    readonly online = new Set<string>();
    readonly sent: { computerId: string; frame: HostedAgentCommand }[] = [];

    isOnline(computerId: string): boolean {
        return this.online.has(computerId);
    }

    send(computerId: string, frame: HostedAgentCommand): boolean {
        if (!this.online.has(computerId)) {
            return false;
        }
        this.sent.push({ computerId, frame });
        return true;
    }

    framesOfType<T extends HostedAgentCommand['type']>(type: T) {
        return this.sent
            .map((entry) => entry.frame)
            .filter(
                (frame): frame is Extract<HostedAgentCommand, { type: T }> => frame.type === type
            );
    }
}

interface Seed {
    agentHandle: string;
    agentId: string;
    chatId: string;
    computerId: string;
    serverId: string;
}

async function seedAgent(): Promise<Seed> {
    const db = connection.db;
    const userId = createOpaqueId('usr');
    const serverId = createOpaqueId('srv');
    const computerId = createOpaqueId('cmp');
    const agentId = createOpaqueId('agt');
    const agentHandle = `ada-${randomBytes(4).toString('hex')}`;
    const chatId = createOpaqueId('cht');
    await db.insert(usersTable).values({ clerkUserId: createOpaqueId('clk'), id: userId });
    await db
        .insert(serversTable)
        .values({ displayName: 'Delivery', id: serverId, slug: createOpaqueId('slug') });
    await db
        .insert(serverMembershipsTable)
        .values({ id: createOpaqueId('mem'), role: 'owner', serverId, userId });
    await db.insert(computersTable).values({
        attachedByUserId: userId,
        credentialHash: randomBytes(32).toString('hex'),
        id: computerId,
        serverId,
    });
    await db.insert(agentsTable).values({
        character: 'owl',
        computerId,
        desiredModelId: 'fake-model',
        desiredRuntimeId: 'fake',
        displayName: 'Ada',
        handle: agentHandle,
        homeTimezone: 'UTC',
        id: agentId,
        role: 'member',
        serverId,
    });
    await db.insert(chatsTable).values({
        dmAgentId: agentId,
        dmMemberOneStint: 1,
        dmMemberOneUserId: userId,
        id: chatId,
        kind: 'dm',
        serverId,
    });
    return { agentHandle, agentId, chatId, computerId, serverId };
}

function turnSummary(
    agentId: string,
    runId: string,
    status: 'completed' | 'failed',
    outputProduced: boolean = status === 'completed'
): HostedAgentTurnSummary {
    return {
        agentId,
        endedAt: new Date().toISOString(),
        messageCount: outputProduced ? 1 : 0,
        outputProduced,
        runId,
        startedAt: new Date().toISOString(),
        status,
        summary: 'ok',
        type: 'turn',
    };
}

async function countTurns(agentId: string): Promise<number> {
    const rows = await connection.db
        .select({ id: agentTurnsTable.id })
        .from(agentTurnsTable)
        .where(eq(agentTurnsTable.agentId, agentId));
    return rows.length;
}

async function countAllPending(agentId: string): Promise<number> {
    const rows = await connection.db
        .select({ id: agentPendingWorkTable.id })
        .from(agentPendingWorkTable)
        .where(eq(agentPendingWorkTable.agentId, agentId));
    return rows.length;
}

/** Adds a second Owner↔Agent DM for the same Agent, seated by a fresh user. */
async function addDmChat(seed: Seed): Promise<string> {
    const db = connection.db;
    const userId = createOpaqueId('usr');
    const chatId = createOpaqueId('cht');
    await db.insert(usersTable).values({ clerkUserId: createOpaqueId('clk'), id: userId });
    await db
        .insert(serverMembershipsTable)
        .values({ id: createOpaqueId('mem'), role: 'member', serverId: seed.serverId, userId });
    await db.insert(chatsTable).values({
        dmAgentId: seed.agentId,
        dmMemberOneStint: 1,
        dmMemberOneUserId: userId,
        id: chatId,
        kind: 'dm',
        serverId: seed.serverId,
    });
    return chatId;
}

test('drains delivered work into one run, then settles it', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'hello there',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });

    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(1);
    expect(starts[0]?.agentName).toBe(seed.agentHandle);
    expect(starts[0]?.homeTimezone).toBe('UTC');
    expect(starts[0]?.prompt).toContain('hello there');
    const runId = starts[0]?.runId ?? '';

    const beforeAck = await readDeliveryState(connection.db, seed.agentId);
    expect(beforeAck?.activeRunId).toBe(runId);
    expect(beforeAck?.acceptedAt).toBeNull();

    await delivery.onAck({ agentId: seed.agentId, runId });
    const afterAck = await readDeliveryState(connection.db, seed.agentId);
    expect(afterAck?.acceptedAt).not.toBeNull();

    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));
    const settled = await readDeliveryState(connection.db, seed.agentId);
    expect(settled?.activeRunId).toBeNull();
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(0);
});

test('resends an unacknowledged delivery idempotently on the retry sweep', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'ping',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId;

    // No ack arrives; the sweep resends the same run, never a second one.
    await delivery.sweep();
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.runId).toBe(runId);
});

test('ignores a duplicate delivery of the same message', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);
    // Offline, so work stays queued and the dedupe is observable as a count.

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'once',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'once',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    // The second delivery deduped: only one inbox row ever existed (already
    // claimed into the offline run), so reconnect redelivers exactly one start.
    expect(await countAllPending(seed.agentId)).toBe(1);

    transport.online.add(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);
    expect(transport.framesOfType('agent-configure')).toEqual([
        {
            agentDescription: null,
            agentId: seed.agentId,
            agentName: 'Ada',
            archetype: null,
            modelId: 'fake-model',
            runtimeId: 'fake',
            type: 'agent-configure',
        },
    ]);
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(1);
    expect(starts[0]?.prompt.match(/once/g)).toHaveLength(1);
});

test('queues work for a busy Agent and notices it, then drains at the boundary', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'first',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const firstRun = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId: firstRun });

    // Busy: the wire notice is content-free, starts no second model turn, and
    // does not append the new body to the active model prompt.
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'second',
        dedupeKey: 'msg-2',
        serverId: seed.serverId,
    });
    expect(transport.framesOfType('start')).toHaveLength(1);
    const notices = transport.framesOfType('notice');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.pending).toBe(1);
    expect('inbox' in (notices[0] ?? {})).toBe(false);
    expect(transport.framesOfType('start')[0]?.prompt).not.toContain('second');

    // The safe boundary: the run settles and the queued work drains into a run.
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, firstRun, 'completed'));
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.runId).not.toBe(firstRun);
    expect(starts[1]?.prompt).toContain('second');
    expect(starts[1]?.prompt).not.toContain('first');
});

test('Stop persists across a restart, suppresses wakes, and keeps accumulating', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'live work',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    await delivery.stop({ agentId: seed.agentId, serverId: seed.serverId });
    const stops = transport.framesOfType('stop');
    expect(stops).toHaveLength(1);
    expect(stops[0]?.runId).toBe(runId);
    const stopped = await readDeliveryState(connection.db, seed.agentId);
    expect(stopped?.stopped).toBe(true);
    expect(stopped?.activeRunId).toBeNull();

    // Stopped: new work accumulates and never dispatches.
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'while stopped',
        dedupeKey: 'msg-2',
        serverId: seed.serverId,
    });
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(2);

    // A fresh Server process (new orchestrator, same durable state) resumes.
    const restarted = new AgentDelivery(connection.db, transport);
    await restarted.start({ agentId: seed.agentId, serverId: seed.serverId });
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.prompt).toContain('live work');
    expect(starts[1]?.prompt).toContain('while stopped');
    expect((await readDeliveryState(connection.db, seed.agentId))?.stopped).toBe(false);
});

test('queues while the Computer is offline and redelivers on reconnect', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'buffered',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    // Offline: work stays queued; a run is created only once a Computer can
    // actually accept it, allowing one reconnect drain across all targets.
    expect(transport.sent).toHaveLength(0);
    const pending = await readDeliveryState(connection.db, seed.agentId);
    expect(pending?.activeRunId).toBeNull();

    transport.online.add(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(1);
    expect(starts[0]?.runId).toBe(
        (await readDeliveryState(connection.db, seed.agentId))?.activeRunId
    );
});

test('records a duplicate turn summary exactly once', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'work',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));

    expect(await countTurns(seed.agentId)).toBe(1);
    expect((await readDeliveryState(connection.db, seed.agentId))?.activeRunId).toBeNull();
});

test('reconnect resends an acknowledged in-flight run (Computer lost its turn)', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'work',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    // The Computer restarts mid-turn (accepted, never settled). Reconnect must
    // resend the same run so it is not stranded; the sweep alone would not.
    await delivery.sweep();
    expect(transport.framesOfType('start')).toHaveLength(1);

    await delivery.onComputerReconnect(seed.computerId);
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.runId).toBe(runId);
});

test('a failed turn backs off instead of tight-looping', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'work',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'failed'));
    // No immediate re-drive, the work is requeued, and a backoff is scheduled.
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect(await countAllPending(seed.agentId)).toBe(1);
    const state = await readDeliveryState(connection.db, seed.agentId);
    expect(state?.consecutiveFailures).toBe(1);
    expect(state?.retryAfter?.getTime()).toBeGreaterThan(Date.now());

    // The sweep respects the backoff window: no resend while retry_after is future.
    await delivery.sweep();
    expect(transport.framesOfType('start')).toHaveLength(1);
});

test('a degraded Agent stops auto-retrying until fresh human intent', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    // Force a degraded row with queued work: many failures, no backoff window.
    await connection.db
        .insert(agentDeliveryTable)
        .values({ agentId: seed.agentId, consecutiveFailures: 99, serverId: seed.serverId });
    await connection.db.insert(agentPendingWorkTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'stuck',
        dedupeKey: 'msg-1',
        id: createOpaqueId('apw'),
        serverId: seed.serverId,
        source: 'human',
    });

    // Degraded: the sweep will not auto-dispatch even with online, queued work.
    await delivery.sweep();
    expect(transport.framesOfType('start')).toHaveLength(0);

    // A new human message clears the degrade and delivers.
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'retry please',
        dedupeKey: 'msg-2',
        serverId: seed.serverId,
    });
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect((await readDeliveryState(connection.db, seed.agentId))?.consecutiveFailures).toBe(0);
});

test('a floating-session run drains queued work across every target', async () => {
    const seed = await seedAgent();
    const chatB = await addDmChat(seed);
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'from chat A',
        dedupeKey: 'a-1',
        serverId: seed.serverId,
    });
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: chatB,
        content: 'from chat B',
        dedupeKey: 'b-1',
        serverId: seed.serverId,
    });

    expect(transport.framesOfType('start')).toHaveLength(0);
    transport.online.add(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);
    const first = transport.framesOfType('start')[0];
    expect(first?.chatId).toBe(seed.chatId);
    expect(first?.prompt).toContain('from chat A');
    expect(first?.prompt).toContain('from chat B');
    expect(first?.inbox.map((item) => item.chatId)).toEqual([seed.chatId, chatB]);
});

test('Stop revokes the run credential so it holds even without the socket', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'work',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    const runnerId = createOpaqueId('arc');
    await connection.db.insert(agentRunnerCredentialsTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        id: runnerId,
        runId,
        serverId: seed.serverId,
        tokenHash: randomBytes(32).toString('hex'),
    });

    await delivery.stop({ agentId: seed.agentId, serverId: seed.serverId });

    const [credential] = await connection.db
        .select({ revokedAt: agentRunnerCredentialsTable.revokedAt })
        .from(agentRunnerCredentialsTable)
        .where(eq(agentRunnerCredentialsTable.id, runnerId));
    expect(credential?.revokedAt).not.toBeNull();
});

test('Restart preserves the session generation and immediately redrives pending work', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'restart me',
        dedupeKey: 'msg-restart',
        serverId: seed.serverId,
    });
    const first = transport.framesOfType('start')[0];

    await delivery.restart({ agentId: seed.agentId, serverId: seed.serverId });

    expect(transport.framesOfType('stop')).toEqual([
        { agentId: seed.agentId, runId: first?.runId, type: 'stop' },
    ]);
    expect(transport.framesOfType('start')).toHaveLength(2);
    expect(transport.framesOfType('start')[1]?.runId).not.toBe(first?.runId);
    const [agent] = await connection.db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, seed.agentId));
    expect(agent?.generation).toBe(1);
});

test('Reset rotates the session and tells the assigned Computer to clear local state', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'reset me',
        dedupeKey: 'msg-reset',
        serverId: seed.serverId,
    });
    const first = transport.framesOfType('start')[0];

    await delivery.reset({ agentId: seed.agentId, kind: 'session', serverId: seed.serverId });

    expect(transport.framesOfType('stop')).toEqual([
        { agentId: seed.agentId, runId: first?.runId, type: 'stop' },
    ]);
    expect(transport.framesOfType('agent-reset')).toEqual([
        { agentId: seed.agentId, kind: 'session', type: 'agent-reset' },
    ]);
    expect((await readDeliveryState(connection.db, seed.agentId))?.activeRunId).toBeNull();
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(1);
    const [agent] = await connection.db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, seed.agentId));
    expect(agent?.generation).toBe(2);
});

test('a failed turn that produced output does not requeue its work', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'do a thing',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    // The turn failed but already produced a durable send — requeuing would
    // re-trigger that output, so the work is dropped, not requeued or replayed.
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'failed', true));
    expect(await countAllPending(seed.agentId)).toBe(0);
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect((await readDeliveryState(connection.db, seed.agentId))?.activeRunId).toBeNull();
});

test('a resent run keeps the runtime and model frozen at first dispatch', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'work',
        dedupeKey: 'msg-1',
        serverId: seed.serverId,
    });
    const first = transport.framesOfType('start')[0];
    expect(first).toMatchObject({ modelId: 'fake-model', runtimeId: 'fake' });
    await delivery.onAck({ agentId: seed.agentId, runId: first?.runId ?? '' });

    // The Agent is reconfigured mid-flight; the in-flight run must not adopt it.
    await connection.db
        .update(agentsTable)
        .set({ desiredModelId: 'new-model', desiredRuntimeId: 'new-runtime' })
        .where(eq(agentsTable.id, seed.agentId));

    await delivery.onComputerReconnect(seed.computerId);
    const resent = transport.framesOfType('start')[1];
    expect(resent?.runId).toBe(first?.runId);
    expect(resent).toMatchObject({ modelId: 'fake-model', runtimeId: 'fake' });
});

test('bounds one drain and carries the overflow in a later run', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    // Three ~10k-char messages exceed the 24k drain budget, so the first run
    // carries two and the third waits for the next.
    const padding = 'x'.repeat(10_000);
    for (let index = 1; index <= 3; index += 1) {
        await connection.db.insert(agentPendingWorkTable).values({
            agentId: seed.agentId,
            chatId: seed.chatId,
            content: `msg-${index}-${padding}`,
            dedupeKey: `msg-${index}`,
            id: createOpaqueId('apw'),
            serverId: seed.serverId,
            source: 'human',
        });
    }
    await connection.db
        .insert(agentDeliveryTable)
        .values({ agentId: seed.agentId, serverId: seed.serverId });

    await delivery.sweep();
    const first = transport.framesOfType('start')[0];
    expect(first?.prompt).toContain('msg-1-');
    expect(first?.prompt).toContain('msg-2-');
    expect(first?.prompt).not.toContain('msg-3-');
    expect(first?.prompt.length).toBeLessThan(200_000);

    await delivery.onAck({ agentId: seed.agentId, runId: first?.runId ?? '' });
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, first?.runId ?? '', 'completed')
    );
    const second = transport.framesOfType('start')[1];
    expect(second?.prompt).toContain('msg-3-');
    expect(second?.prompt).not.toContain('msg-1-');
});
