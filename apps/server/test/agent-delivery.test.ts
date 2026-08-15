import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import type { AgentCommand, AgentTurnSummary } from '@tavern/api';
import { and, eq, ne } from 'drizzle-orm';
import { attestAgentEvents, pullAgentEvents } from '../src/agent-api/inbox.ts';
import { markCursorSubsumedSeen, readAgentInboxCursor } from '../src/agent-delivery/cursors.ts';
import { AgentDelivery, type DeliveryTransport } from '../src/agent-delivery/delivery.ts';
import { subscribeToAgentLifecycle } from '../src/agent-delivery/lifecycle.ts';
import { countQueuedPending, readDeliveryState } from '../src/agent-delivery/store.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createOpaqueId } from '../src/postgres/opaque-id.ts';
import {
    agentDeliveryTable,
    agentInboxCursorsTable,
    agentPendingWorkTable,
    agentRunnerCredentialsTable,
    agentsTable,
    agentTurnsTable,
    chatMessagesTable,
    chatsTable,
    computersTable,
    messageTasksTable,
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
    readonly sent: { computerId: string; frame: AgentCommand }[] = [];

    isOnline(computerId: string): boolean {
        return this.online.has(computerId);
    }

    send(computerId: string, frame: AgentCommand): boolean {
        if (!this.online.has(computerId)) {
            return false;
        }
        this.sent.push({ computerId, frame });
        return true;
    }

    framesOfType<T extends AgentCommand['type']>(type: T) {
        return this.sent
            .map((entry) => entry.frame)
            .filter((frame): frame is Extract<AgentCommand, { type: T }> => frame.type === type);
    }
}

interface Seed {
    agentHandle: string;
    agentId: string;
    chatId: string;
    computerId: string;
    serverId: string;
    userId: string;
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
    return { agentHandle, agentId, chatId, computerId, serverId, userId };
}

function turnSummary(
    agentId: string,
    runId: string,
    status: 'completed' | 'failed',
    outputProduced: boolean = status === 'completed',
    failureKind?: AgentTurnSummary['failureKind']
): AgentTurnSummary {
    return {
        agentId,
        endedAt: new Date().toISOString(),
        ...(failureKind ? { failureKind } : {}),
        messageCount: outputProduced ? 1 : 0,
        modelId: 'gpt-test',
        outputProduced,
        runId,
        runtimeId: 'codex',
        startedAt: new Date().toISOString(),
        status,
        summary: 'ok',
        tokenUsage: null,
        type: 'turn',
        visibleMessages: [],
    };
}

async function countTurns(agentId: string): Promise<number> {
    const rows = await connection.db
        .select({ id: agentTurnsTable.id })
        .from(agentTurnsTable)
        .where(eq(agentTurnsTable.agentId, agentId));
    return rows.length;
}

/**
 * Rows still in the delivery pipeline. Settled `seen` rows are retained as turn
 * evidence, so they are not pending work any more.
 */
async function countUnsettledPending(agentId: string): Promise<number> {
    const rows = await connection.db
        .select({ id: agentPendingWorkTable.id })
        .from(agentPendingWorkTable)
        .where(
            and(eq(agentPendingWorkTable.agentId, agentId), ne(agentPendingWorkTable.state, 'seen'))
        );
    return rows.length;
}

async function readDeliveryLedger(agentId: string) {
    return await connection.db
        .select({
            acceptedAt: agentPendingWorkTable.acceptedAt,
            dedupeKey: agentPendingWorkTable.dedupeKey,
            seenAt: agentPendingWorkTable.seenAt,
            settledRunId: agentPendingWorkTable.settledRunId,
            state: agentPendingWorkTable.state,
        })
        .from(agentPendingWorkTable)
        .where(eq(agentPendingWorkTable.agentId, agentId));
}

async function insertHumanMessage(seed: Seed, content: string, sequence: number): Promise<string> {
    const messageId = createOpaqueId('msg');
    await connection.db.insert(chatMessagesTable).values({
        authorUserId: seed.userId,
        chatId: seed.chatId,
        content,
        id: messageId,
        nonce: createOpaqueId('nonce'),
        sequence,
        serverId: seed.serverId,
    });
    return messageId;
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

test('offers ordinary Chat work as a notice and does not loop when it is deferred', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const lifecycleController = new AbortController();
    const lifecycle = subscribeToAgentLifecycle(lifecycleController.signal)[Symbol.asyncIterator]();
    const working = lifecycle.next();

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
    expect(starts[0]?.inbox.map((item) => item.content)).toEqual(['hello there']);
    expect(starts[0]?.inboxDelivery).toBe('notice');
    const runId = starts[0]?.runId ?? '';
    expect(await working).toMatchObject({
        done: false,
        value: { agentId: seed.agentId, chatId: seed.chatId, phase: 'working', runId },
    });

    const beforeAck = await readDeliveryState(connection.db, seed.agentId);
    expect(beforeAck?.activeRunId).toBe(runId);
    expect(beforeAck?.acceptedAt).toBeNull();

    const reading = lifecycle.next();
    await delivery.onAck({ agentId: seed.agentId, runId });
    const afterAck = await readDeliveryState(connection.db, seed.agentId);
    expect(afterAck?.acceptedAt).not.toBeNull();
    expect(await reading).toMatchObject({
        done: false,
        value: { agentId: seed.agentId, chatId: seed.chatId, phase: 'reading', runId },
    });

    const completed = lifecycle.next();
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));
    const settled = await readDeliveryState(connection.db, seed.agentId);
    expect(settled?.activeRunId).toBeNull();
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(1);
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect(await completed).toMatchObject({
        done: false,
        value: {
            agentId: seed.agentId,
            chatId: seed.chatId,
            outcome: 'completed',
            phase: 'settled',
            runId,
        },
    });
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'new identity',
        dedupeKey: 'msg-2',
        serverId: seed.serverId,
    });
    expect(transport.framesOfType('start')).toHaveLength(2);
    expect(transport.framesOfType('start')[1]?.inbox.map((item) => item.content)).toEqual([
        'hello there',
        'new identity',
    ]);
    lifecycleController.abort();
});

test('keeps a queued message bound to its retired author after handle reuse', async () => {
    const seed = await seedAgent();
    const authorId = createOpaqueId('agt');
    const replacementId = createOpaqueId('agt');
    const handle = `echo-${randomBytes(4).toString('hex')}`;
    const messageId = createOpaqueId('msg');
    await connection.db.insert(agentsTable).values({
        computerId: seed.computerId,
        description: 'Original teammate',
        desiredModelId: 'fake-model',
        desiredRuntimeId: 'fake',
        displayName: 'Echo',
        handle,
        homeTimezone: 'UTC',
        id: authorId,
        role: 'member',
        serverId: seed.serverId,
    });
    await connection.db.insert(chatMessagesTable).values({
        authorAgentId: authorId,
        chatId: seed.chatId,
        content: 'Historical work',
        id: messageId,
        nonce: createOpaqueId('nonce'),
        sequence: 1,
        serverId: seed.serverId,
    });
    await connection.db
        .update(agentsTable)
        .set({ retiredAt: new Date() })
        .where(eq(agentsTable.id, authorId));
    await connection.db.insert(agentsTable).values({
        computerId: seed.computerId,
        description: 'Replacement teammate',
        desiredModelId: 'fake-model',
        desiredRuntimeId: 'fake',
        displayName: 'Echo',
        handle,
        homeTimezone: 'UTC',
        id: replacementId,
        role: 'member',
        serverId: seed.serverId,
    });

    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'Historical work',
        dedupeKey: messageId,
        sequence: 1,
        serverId: seed.serverId,
        source: `agent:${handle}`,
    });

    expect(transport.framesOfType('start')[0]?.inbox[0]).toMatchObject({
        senderDescription: 'Original teammate',
        senderHandle: handle,
        senderType: 'agent',
    });
});

test('pending Cove work cannot start before the durable factory acknowledgement', async () => {
    const seed = await seedAgent();
    await connection.db
        .update(agentsTable)
        .set({ factoryAppliedAt: null, factoryKind: 'cove' })
        .where(eq(agentsTable.id, seed.agentId));
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'arrived during setup',
        dedupeKey: 'pending-cove',
        serverId: seed.serverId,
    });

    expect(transport.framesOfType('start')).toHaveLength(0);
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(1);
});

test('delivers non-Chat onboarding attention concretely without entering message check', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'Introduce yourself once.',
        dedupeKey: createOpaqueId('app'),
        serverId: seed.serverId,
        source: 'onboarding',
    });
    const start = transport.framesOfType('start')[0];
    expect(start?.inboxDelivery).toBe('concrete');
    expect(start?.inbox[0]?.message).toBeUndefined();
    await delivery.onAck({ agentId: seed.agentId, runId: start?.runId ?? '' });
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, start?.runId ?? '', 'completed')
    );
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
});

test('keeps onboarding attention out of message check while an ordinary turn is live', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const messageId = await insertHumanMessage(seed, 'ordinary', 1);
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'ordinary',
        dedupeKey: messageId,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'Introduce yourself once.',
        dedupeKey: createOpaqueId('app'),
        serverId: seed.serverId,
        source: 'onboarding',
    });

    const pulled = await pullAgentEvents(connection.db, {
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    });
    expect(pulled.messages.map((row) => row.message.id)).toEqual([messageId]);
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));
    expect(transport.framesOfType('start')[1]?.inboxDelivery).toBe('concrete');
    expect(transport.framesOfType('start')[1]?.inbox[0]?.senderType).toBe('system');
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
    expect(await countUnsettledPending(seed.agentId)).toBe(1);

    transport.online.add(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);
    expect(transport.framesOfType('agent-configure')).toEqual([
        {
            agentDescription: null,
            agentId: seed.agentId,
            agentName: 'Ada',
            factoryKind: 'ordinary',
            modelId: 'fake-model',
            runtimeId: 'fake',
            sessionGeneration: 1,
            sessionResetKind: 'session',
            type: 'agent-configure',
        },
    ]);
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(1);
    expect(starts[0]?.inbox.map((item) => item.content)).toEqual(['once']);
});

test('replays durable Agent retirement tombstones on Computer reconnect', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);
    transport.online.add(seed.computerId);

    delivery.retireAgent({ agentId: seed.agentId, computerId: seed.computerId });
    expect(transport.framesOfType('agent-retire')).toEqual([
        { agentId: seed.agentId, type: 'agent-retire' },
    ]);
    transport.sent.length = 0;

    await connection.db
        .update(agentsTable)
        .set({ retiredAt: new Date() })
        .where(eq(agentsTable.id, seed.agentId));

    await delivery.onComputerReconnect(seed.computerId);

    expect(transport.framesOfType('agent-retire')).toEqual([
        { agentId: seed.agentId, type: 'agent-retire' },
    ]);
    expect(transport.framesOfType('agent-configure')).toEqual([]);
    expect(transport.framesOfType('start')).toEqual([]);
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

    // Busy: the Computer receives the full durable envelope, starts no second
    // model turn, and projects only content-free metadata into the live turn.
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
    expect(notices[0]?.inbox.map((item) => item.content)).toEqual(['first', 'second']);
    expect(notices[0]?.totalPending).toBe(2);
    expect(transport.framesOfType('start')[0]?.inbox.map((item) => item.content)).toEqual([
        'first',
    ]);
    await delivery.onNoticeAck({
        agentId: seed.agentId,
        messageIds: ['msg-1', 'msg-2'],
        runId: firstRun,
    });

    // Both identities were offered to this live turn. Deferral must not create
    // another turn for the unchanged pending set.
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, firstRun, 'completed'));
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(1);
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(2);
});

test('settles explicitly pulled busy work with the active run without a second turn', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const firstMessageId = await insertHumanMessage(seed, 'first', 1);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'first',
        dedupeKey: firstMessageId,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    const followUpMessageId = await insertHumanMessage(seed, 'follow up', 2);
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'follow up',
        dedupeKey: followUpMessageId,
        serverId: seed.serverId,
    });
    const pulled = await pullAgentEvents(connection.db, {
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    });
    expect(pulled.messages.map((row) => row.message.content)).toEqual(['first', 'follow up']);
    expect(
        await readAgentInboxCursor(connection.db, {
            agentId: seed.agentId,
            chatId: seed.chatId,
            serverId: seed.serverId,
        })
    ).toMatchObject({ seen: 0, served: 2 });

    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));

    expect(transport.framesOfType('start')).toHaveLength(1);
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
    expect(
        await readAgentInboxCursor(connection.db, {
            agentId: seed.agentId,
            chatId: seed.chatId,
            serverId: seed.serverId,
        })
    ).toMatchObject({ seen: 2, served: 2 });
});

test('settles exact Computer-local visibility carried by the turn summary', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const messageId = await insertHumanMessage(seed, 'local cache body', 1);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'local cache body',
        dedupeKey: messageId,
        sequence: 1,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await delivery.onTurnSettled(seed.computerId, {
        ...turnSummary(seed.agentId, runId, 'completed'),
        visibleMessages: [{ chatId: seed.chatId, id: messageId, sequence: 1 }],
    });

    expect(await countUnsettledPending(seed.agentId)).toBe(0);
    expect(
        await readAgentInboxCursor(connection.db, {
            agentId: seed.agentId,
            chatId: seed.chatId,
            serverId: seed.serverId,
        })
    ).toMatchObject({ seen: 1 });
});

test('settlement tolerates valid visibility whose pending row was already removed', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const messageId = await insertHumanMessage(seed, 'removed after visibility', 1);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'removed after visibility',
        dedupeKey: messageId,
        sequence: 1,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await connection.db
        .delete(agentPendingWorkTable)
        .where(eq(agentPendingWorkTable.agentId, seed.agentId));

    await delivery.onTurnSettled(seed.computerId, {
        ...turnSummary(seed.agentId, runId, 'completed'),
        visibleMessages: [{ chatId: seed.chatId, id: messageId, sequence: 1 }],
    });

    expect((await readDeliveryState(connection.db, seed.agentId))?.activeRunId).toBeNull();
});

test('a bounded notice window always contains the newly unnoticed identity', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'initial',
        dedupeKey: 'msg-initial',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    for (let index = 0; index < 50; index += 1) {
        await delivery.deliver({
            agentId: seed.agentId,
            chatId: seed.chatId,
            content: `backlog ${index}`,
            dedupeKey: `msg-backlog-${index}`,
            serverId: seed.serverId,
        });
    }
    const fullWindow = transport.framesOfType('notice').at(-1);
    await delivery.onNoticeAck({
        agentId: seed.agentId,
        messageIds: fullWindow?.inbox.map((item) => item.id) ?? [],
        runId,
    });

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'newest',
        dedupeKey: 'msg-newest',
        serverId: seed.serverId,
    });

    expect(
        transport
            .framesOfType('notice')
            .at(-1)
            ?.inbox.map((item) => item.id)
    ).toContain('msg-newest');

    await delivery.onComputerReconnect(seed.computerId);
    const resentStart = transport.framesOfType('start').at(-1);
    expect(resentStart?.inbox.map((item) => item.id)).toEqual(['msg-initial']);
    await delivery.onAck({ agentId: seed.agentId, runId });
    expect(
        transport
            .framesOfType('notice')
            .at(-1)
            ?.inbox.map((item) => item.id)
    ).toContain('msg-newest');
});

test('accepts a repeated Computer-local visibility receipt after a committed receipt crash', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const messageId = await insertHumanMessage(seed, 'local cache retry', 1);
    const oldHistoryId = await insertHumanMessage(seed, 'old history', 2);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'local cache retry',
        dedupeKey: messageId,
        sequence: 1,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    const runner = {
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    };
    const identities = [{ chatId: seed.chatId, id: messageId, sequence: 1 }];

    await expect(
        attestAgentEvents(connection.db, runner, [
            ...identities,
            { chatId: seed.chatId, id: oldHistoryId, sequence: 2 },
        ])
    ).resolves.toEqual({ accepted: [messageId] });
    await expect(attestAgentEvents(connection.db, runner, identities)).resolves.toEqual({
        accepted: [messageId],
    });
});

test('attests a multi-message Computer-local pull without wedging the transaction', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const messageIds = await Promise.all([
        insertHumanMessage(seed, 'task anchor one', 1),
        insertHumanMessage(seed, 'task anchor two', 2),
    ]);
    const threadChatId = `cht_thr_${messageIds[0]?.slice(4)}`;
    await connection.db.insert(chatsTable).values({
        anchorMessageId: messageIds[0],
        id: threadChatId,
        kind: 'thread',
        parentChatId: seed.chatId,
        serverId: seed.serverId,
    });
    const briefingId = createOpaqueId('msg');
    await connection.db.insert(chatMessagesTable).values({
        authorUserId: seed.userId,
        chatId: threadChatId,
        content: 'task thread briefing',
        id: briefingId,
        nonce: createOpaqueId('nonce'),
        sequence: 1,
        serverId: seed.serverId,
    });
    messageIds.push(briefingId);
    await connection.db.insert(messageTasksTable).values([
        {
            assigneeAgentId: seed.agentId,
            chatId: seed.chatId,
            createdByUserId: seed.userId,
            messageId: messageIds[0] ?? '',
            number: 1,
            origin: 'composed',
            serverId: seed.serverId,
            status: 'todo',
        },
        {
            assigneeAgentId: seed.agentId,
            chatId: seed.chatId,
            createdByUserId: seed.userId,
            messageId: messageIds[1] ?? '',
            number: 2,
            origin: 'composed',
            serverId: seed.serverId,
            status: 'todo',
        },
    ]);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'task anchor one',
        dedupeKey: messageIds[0] ?? '',
        sequence: 1,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await connection.db.insert(agentPendingWorkTable).values([
        {
            agentId: seed.agentId,
            chatId: seed.chatId,
            content: 'task anchor two',
            dedupeKey: messageIds[1] ?? '',
            id: createOpaqueId('apw'),
            serverId: seed.serverId,
            source: 'human',
        },
        {
            agentId: seed.agentId,
            chatId: threadChatId,
            content: 'task thread briefing',
            dedupeKey: messageIds[2] ?? '',
            id: createOpaqueId('apw'),
            serverId: seed.serverId,
            source: 'human',
        },
    ]);
    const runner = {
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    };

    await expect(
        attestAgentEvents(
            connection.db,
            runner,
            messageIds.map((id, index) => ({
                chatId: index === 2 ? threadChatId : seed.chatId,
                id,
                sequence: index === 2 ? 1 : index + 1,
            }))
        )
    ).resolves.toEqual({ accepted: messageIds });
});

test('reconnect replays busy work pulled by an unsettled active run', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const firstMessageId = await insertHumanMessage(seed, 'first', 1);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'first',
        dedupeKey: firstMessageId,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    const followUpMessageId = await insertHumanMessage(seed, 'pull then crash', 2);
    await connection.db.insert(messageTasksTable).values({
        assigneeAgentId: seed.agentId,
        chatId: seed.chatId,
        claimedAt: new Date(),
        createdByUserId: seed.userId,
        messageId: followUpMessageId,
        number: 1,
        origin: 'composed',
        serverId: seed.serverId,
        status: 'in_progress',
    });
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'pull then crash',
        dedupeKey: followUpMessageId,
        serverId: seed.serverId,
    });
    await pullAgentEvents(connection.db, {
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    });

    await delivery.onComputerReconnect(seed.computerId);

    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.runId).toBe(runId);
    expect(starts[1]?.inbox.map((item) => item.content)).toEqual(['first', 'pull then crash']);
    expect(starts[1]?.inbox[1]?.task).toMatchObject({
        assigneeAgentId: seed.agentId,
        number: 1,
        status: 'in_progress',
    });
    expect(await countUnsettledPending(seed.agentId)).toBe(2);
    expect(
        await readAgentInboxCursor(connection.db, {
            agentId: seed.agentId,
            chatId: seed.chatId,
            serverId: seed.serverId,
        })
    ).toMatchObject({ seen: 0, served: 2 });
});

test('Stop persists across a restart, suppresses wakes, and keeps accumulating', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const generationBefore = await connection.db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, seed.agentId));

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
    expect(starts[1]?.inbox.map((item) => item.content)).toEqual(['live work', 'while stopped']);
    expect((await readDeliveryState(connection.db, seed.agentId))?.stopped).toBe(false);
    const generationAfter = await connection.db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, seed.agentId));
    expect(generationAfter).toEqual(generationBefore);
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

test('repeated reconnects settle one durable result for one delivery', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'buffered once',
        dedupeKey: 'msg-reconnect-once',
        serverId: seed.serverId,
        source: 'onboarding',
    });

    transport.online.add(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);

    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(3);
    expect(new Set(starts.map((frame) => frame.runId)).size).toBe(1);
    const runId = starts[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'completed'));
    await delivery.onComputerReconnect(seed.computerId);

    expect(transport.framesOfType('start')).toHaveLength(3);
    expect(await countTurns(seed.agentId)).toBe(1);
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
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
    expect(await countUnsettledPending(seed.agentId)).toBe(1);
    const state = await readDeliveryState(connection.db, seed.agentId);
    expect(state?.consecutiveFailures).toBe(1);
    expect(state?.retryAfter?.getTime()).toBeGreaterThan(Date.now());

    // The sweep respects the backoff window: no resend while retry_after is future.
    await delivery.sweep();
    expect(transport.framesOfType('start')).toHaveLength(1);
});

test('an expired backoff redrives and settles the queued work once', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'retry me',
        dedupeKey: 'msg-backoff-expiry',
        serverId: seed.serverId,
        source: 'onboarding',
    });
    const firstRunId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId: firstRunId });
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, firstRunId, 'failed'));
    await connection.db
        .update(agentDeliveryTable)
        .set({ retryAfter: new Date(Date.now() - 1) })
        .where(eq(agentDeliveryTable.agentId, seed.agentId));

    await delivery.sweep();
    const starts = transport.framesOfType('start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.runId).not.toBe(firstRunId);
    expect(starts[1]?.inbox.map((item) => item.content)).toEqual(['retry me']);

    const retryRunId = starts[1]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId: retryRunId });
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, retryRunId, 'completed')
    );
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, retryRunId, 'completed')
    );
    await delivery.sweep();

    expect(transport.framesOfType('start')).toHaveLength(2);
    expect(await countTurns(seed.agentId)).toBe(2);
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
});

test('an operator-action failure degrades immediately instead of spending retries', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'work',
        dedupeKey: 'msg-auth',
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, runId, 'failed', false, 'authentication')
    );

    const state = await readDeliveryState(connection.db, seed.agentId);
    expect(state?.consecutiveFailures).toBe(5);
    expect(state?.retryAfter).toBeNull();
    expect(await countUnsettledPending(seed.agentId)).toBe(1);
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

test('Restart clears a degraded Agent failure hold and redrives queued work', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await connection.db
        .insert(agentDeliveryTable)
        .values({ agentId: seed.agentId, consecutiveFailures: 5, serverId: seed.serverId });
    await connection.db.insert(agentPendingWorkTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'retry after repair',
        dedupeKey: 'msg-restart-degraded',
        id: createOpaqueId('apw'),
        serverId: seed.serverId,
        source: 'human',
    });

    await delivery.restart({ agentId: seed.agentId, serverId: seed.serverId });

    expect(transport.framesOfType('start')).toHaveLength(1);
    expect(transport.framesOfType('start')[0]?.inbox.map((item) => item.content)).toEqual([
        'retry after repair',
    ]);
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
    expect(first?.inbox.map((item) => item.content)).toEqual(['from chat A', 'from chat B']);
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
        source: 'onboarding',
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
    expect(transport.framesOfType('agent-restart')).toEqual([
        { agentId: seed.agentId, type: 'agent-restart' },
    ]);
    expect(transport.framesOfType('start')).toHaveLength(2);
    expect(transport.framesOfType('start')[1]?.runId).not.toBe(first?.runId);
    const [agent] = await connection.db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, seed.agentId));
    expect(agent?.generation).toBe(1);
});

test('Restart fails without disturbing pending work when the assigned Computer is offline', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);

    await expect(
        delivery.restart({ agentId: seed.agentId, serverId: seed.serverId })
    ).rejects.toThrow('The assigned Computer must be online');
    expect(transport.sent).toEqual([]);
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
    const runnerId = createOpaqueId('arc');
    await connection.db.insert(agentRunnerCredentialsTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        id: runnerId,
        runId: first?.runId ?? '',
        serverId: seed.serverId,
        tokenHash: randomBytes(32).toString('hex'),
    });

    await delivery.reset({ agentId: seed.agentId, kind: 'session', serverId: seed.serverId });

    expect(transport.framesOfType('stop')).toEqual([
        { agentId: seed.agentId, runId: first?.runId, type: 'stop' },
    ]);
    expect(transport.framesOfType('agent-reset')).toEqual([
        {
            agentId: seed.agentId,
            kind: 'session',
            sessionGeneration: 2,
            type: 'agent-reset',
        },
    ]);
    expect((await readDeliveryState(connection.db, seed.agentId))?.activeRunId).toBeNull();
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(1);
    const [agent] = await connection.db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, seed.agentId));
    expect(agent?.generation).toBe(2);
    const [credential] = await connection.db
        .select({ revokedAt: agentRunnerCredentialsTable.revokedAt })
        .from(agentRunnerCredentialsTable)
        .where(eq(agentRunnerCredentialsTable.id, runnerId));
    expect(credential?.revokedAt).not.toBeNull();
    const receipts = await connection.db
        .select({
            content: chatMessagesTable.content,
            systemAuthor: chatMessagesTable.systemAuthor,
        })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.chatId, seed.chatId));
    expect(receipts).toEqual([
        {
            content:
                'Started a fresh session. New messages start with fresh context; the workspace and MEMORY.md are intact.',
            systemAuthor: 'session',
        },
    ]);
});

test('offline reset reconnects with authoritative configuration before redelivery', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'resume after reset',
        dedupeKey: 'msg-offline-reset',
        serverId: seed.serverId,
    });
    await delivery.reset({ agentId: seed.agentId, kind: 'full', serverId: seed.serverId });
    expect(transport.sent).toEqual([]);

    transport.online.add(seed.computerId);
    await delivery.onComputerReconnect(seed.computerId);

    expect(transport.sent.map(({ frame }) => frame.type)).toEqual(['agent-configure', 'start']);
    expect(transport.framesOfType('agent-configure')[0]).toMatchObject({
        agentId: seed.agentId,
        sessionGeneration: 2,
        sessionResetKind: 'full',
    });
    expect(transport.framesOfType('start')[0]).toMatchObject({
        agentId: seed.agentId,
        sessionGeneration: 2,
    });
});

test('resume rejection rotates on the Server and retries from a fresh session', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'continue this work',
        dedupeKey: 'msg-resume-rejected',
        serverId: seed.serverId,
    });
    const firstRunId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, firstRunId, 'failed', false, 'session-resume')
    );

    expect(transport.sent.map(({ frame }) => frame.type)).toEqual([
        'start',
        'agent-configure',
        'start',
    ]);
    expect(transport.framesOfType('agent-configure')[0]).toMatchObject({
        agentId: seed.agentId,
        sessionGeneration: 2,
        sessionResetKind: 'session',
    });
    const retry = transport.framesOfType('start')[1];
    expect(retry).toMatchObject({
        agentId: seed.agentId,
        inbox: [expect.objectContaining({ content: 'continue this work' })],
        sessionGeneration: 2,
    });
    expect(retry?.runId).not.toBe(firstRunId);
    const [receipt] = await connection.db
        .select({
            content: chatMessagesTable.content,
            systemAuthor: chatMessagesTable.systemAuthor,
        })
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.chatId, seed.chatId));
    expect(receipt).toEqual({
        content:
            'Started a fresh session because the previous runtime context could not be resumed. The workspace and MEMORY.md are intact.',
        systemAuthor: 'session',
    });
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
        source: 'onboarding',
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    // The turn failed but already produced a durable send — requeuing would
    // re-trigger that output, so the work is dropped, not requeued or replayed.
    await delivery.onTurnSettled(seed.computerId, turnSummary(seed.agentId, runId, 'failed', true));
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect((await readDeliveryState(connection.db, seed.agentId))?.activeRunId).toBeNull();
});

test('served cursor never consumes queued work without seen proof', async () => {
    const seed = await seedAgent();
    const messageId = createOpaqueId('msg');
    await connection.db.insert(chatMessagesTable).values({
        authorUserId: seed.userId,
        chatId: seed.chatId,
        content: 'pull then crash',
        id: messageId,
        nonce: createOpaqueId('nonce'),
        sequence: 1,
        serverId: seed.serverId,
    });
    await connection.db.insert(agentPendingWorkTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'pull then crash',
        dedupeKey: messageId,
        id: createOpaqueId('apw'),
        serverId: seed.serverId,
        source: 'human',
    });
    await connection.db.insert(agentInboxCursorsTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        deliveredUpToSequence: 1,
        seenUpToSequence: 0,
        servedUpToSequence: 1,
        serverId: seed.serverId,
        sessionGeneration: 1,
    });

    await markCursorSubsumedSeen(connection.db, {
        agentId: seed.agentId,
        serverId: seed.serverId,
    });
    expect(await countUnsettledPending(seed.agentId)).toBe(1);

    await connection.db
        .update(agentInboxCursorsTable)
        .set({ seenUpToSequence: 1 })
        .where(eq(agentInboxCursorsTable.agentId, seed.agentId));
    await markCursorSubsumedSeen(connection.db, {
        agentId: seed.agentId,
        serverId: seed.serverId,
    });
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
});

test('agent-only chain ceiling preserves work until human intent arrives', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    await connection.db.insert(agentDeliveryTable).values({
        agentChainTurns: 16,
        agentId: seed.agentId,
        serverId: seed.serverId,
    });
    await connection.db.insert(agentPendingWorkTable).values({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'agent ping',
        dedupeKey: 'msg-agent-chain',
        id: createOpaqueId('apw'),
        serverId: seed.serverId,
        source: 'agent:wren',
    });

    await delivery.sweep();
    expect(transport.framesOfType('start')).toHaveLength(0);
    expect(await countUnsettledPending(seed.agentId)).toBe(1);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'human reset',
        dedupeKey: 'msg-human-reset',
        serverId: seed.serverId,
    });
    expect(transport.framesOfType('start')).toHaveLength(1);
    expect(transport.framesOfType('start')[0]?.inbox).toHaveLength(2);
});

test('an output sent from agent-authored notice metadata still spends chain budget', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'agent ping',
        dedupeKey: 'msg-agent-notice-output',
        serverId: seed.serverId,
        source: 'agent:wren',
    });

    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, runId, 'completed', true)
    );

    expect((await readDeliveryState(connection.db, seed.agentId))?.agentChainTurns).toBe(1);
    expect(await countUnsettledPending(seed.agentId)).toBe(1);
});

test('a resent run stays frozen and the next delivery uses the changed runtime and model', async () => {
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
        source: 'onboarding',
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

    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, first?.runId ?? '', 'completed')
    );
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'next work',
        dedupeKey: 'msg-2',
        serverId: seed.serverId,
        source: 'onboarding',
    });

    const next = transport.framesOfType('start')[2];
    expect(next?.runId).not.toBe(first?.runId);
    expect(next).toMatchObject({ modelId: 'new-model', runtimeId: 'new-runtime' });
    expect(next?.inbox.map((item) => item.content)).toEqual(['next work']);
    expect(
        transport
            .framesOfType('start')
            .filter((frame) => frame.modelId === 'new-model' && frame.runtimeId === 'new-runtime')
    ).toHaveLength(1);
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
            source: 'onboarding',
        });
    }
    await connection.db
        .insert(agentDeliveryTable)
        .values({ agentId: seed.agentId, serverId: seed.serverId });

    await delivery.sweep();
    const first = transport.framesOfType('start')[0];
    expect(first?.inbox.map((item) => item.content.slice(0, 6))).toEqual(['msg-1-', 'msg-2-']);

    await delivery.onAck({ agentId: seed.agentId, runId: first?.runId ?? '' });
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, first?.runId ?? '', 'completed')
    );
    const second = transport.framesOfType('start')[1];
    expect(second?.inbox.map((item) => item.content.slice(0, 6))).toEqual(['msg-3-']);
});

test('retains a settled delivery as proof the Agent read an FYI and answered nothing', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const messageId = await insertHumanMessage(seed, 'fyi, the deploy finished', 1);

    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'fyi, the deploy finished',
        dedupeKey: messageId,
        serverId: seed.serverId,
    });
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });
    await pullAgentEvents(connection.db, {
        agentId: seed.agentId,
        chatId: seed.chatId,
        computerId: seed.computerId,
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    });
    const served = await readDeliveryLedger(seed.agentId);
    expect(served).toMatchObject([{ dedupeKey: messageId, state: 'served' }]);
    expect(served[0]?.acceptedAt).not.toBeNull();

    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, runId, 'completed', false)
    );

    // The row is gone from the live queue but still readable as evidence.
    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(0);
    expect(await countUnsettledPending(seed.agentId)).toBe(0);
    const ledger = await readDeliveryLedger(seed.agentId);
    expect(ledger).toMatchObject([{ dedupeKey: messageId, settledRunId: runId, state: 'seen' }]);
    expect(ledger[0]?.seenAt).not.toBeNull();

    const [turn] = await connection.db
        .select({
            failureKind: agentTurnsTable.failureKind,
            messageCount: agentTurnsTable.messageCount,
            outputProduced: agentTurnsTable.outputProduced,
            status: agentTurnsTable.status,
        })
        .from(agentTurnsTable)
        .where(eq(agentTurnsTable.runId, runId));
    expect(turn).toEqual({
        failureKind: null,
        messageCount: 0,
        outputProduced: false,
        status: 'completed',
    });
    expect(transport.framesOfType('start')).toHaveLength(1);
});

test('retains a delivery the seen cursor subsumed instead of erasing it', async () => {
    const seed = await seedAgent();
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    const firstMessageId = await insertHumanMessage(seed, 'earlier note', 1);
    const secondMessageId = await insertHumanMessage(seed, 'later note', 2);

    for (const [index, messageId] of [firstMessageId, secondMessageId].entries()) {
        await delivery.deliver({
            agentId: seed.agentId,
            chatId: seed.chatId,
            content: index === 0 ? 'earlier note' : 'later note',
            dedupeKey: messageId,
            sequence: index + 1,
            serverId: seed.serverId,
        });
    }
    const runId = transport.framesOfType('start')[0]?.runId ?? '';
    await delivery.onAck({ agentId: seed.agentId, runId });

    // Only the later message is attested, so the earlier one is proven read by
    // the seen cursor rather than by its own run attachment.
    await attestAgentEvents(
        connection.db,
        {
            agentId: seed.agentId,
            chatId: seed.chatId,
            computerId: seed.computerId,
            runId,
            runnerId: createOpaqueId('arc'),
            serverId: seed.serverId,
        },
        [{ chatId: seed.chatId, id: secondMessageId, sequence: 2 }]
    );
    await delivery.onTurnSettled(
        seed.computerId,
        turnSummary(seed.agentId, runId, 'completed', false)
    );

    expect(await countQueuedPending(connection.db, seed.agentId)).toBe(0);
    const ledger = await readDeliveryLedger(seed.agentId);
    expect(ledger).toHaveLength(2);
    const subsumed = ledger.find((row) => row.dedupeKey === firstMessageId);
    expect(subsumed).toMatchObject({ settledRunId: null, state: 'seen' });
    expect(subsumed?.seenAt).not.toBeNull();
    expect(ledger.find((row) => row.dedupeKey === secondMessageId)).toMatchObject({
        settledRunId: runId,
        state: 'seen',
    });
});
