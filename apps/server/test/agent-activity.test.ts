import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import type {
    HostedAgentActivityFrame,
    HostedAgentCommand,
    HostedAgentTurnSummary,
} from '@tavern/api';
import { and, asc, eq } from 'drizzle-orm';
import { AgentDelivery, type DeliveryTransport } from '../src/agent-delivery/delivery.ts';
import {
    appendServerAgentActivity,
    recordComputerAgentActivity,
    recordComputerAgentActivityWithStatus,
} from '../src/hosted-agents/agent-activity.ts';
import {
    listHostedAgentActivityHistory,
    readHostedActiveAgentActivity,
} from '../src/hosted-agents/agent-activity-history.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createOpaqueId } from '../src/postgres/opaque-id.ts';
import {
    agentActivityTable,
    agentsTable,
    chatsTable,
    computersTable,
    serverMembershipsTable,
    serversTable,
    usersTable,
} from '../src/postgres/schema.ts';
import { lockServerRow } from '../src/servers/server-lock.ts';
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

class FakeTransport implements DeliveryTransport {
    readonly online = new Set<string>();
    readonly sent: HostedAgentCommand[] = [];

    isOnline(computerId: string) {
        return this.online.has(computerId);
    }

    send(computerId: string, frame: HostedAgentCommand) {
        if (!this.online.has(computerId)) {
            return false;
        }
        this.sent.push(frame);
        return true;
    }
}

interface Seed {
    agentId: string;
    chatId: string;
    computerId: string;
    serverId: string;
}

async function seedActivity(): Promise<Seed> {
    const userId = createOpaqueId('usr');
    const serverId = createOpaqueId('srv');
    const computerId = createOpaqueId('cmp');
    const agentId = createOpaqueId('agt');
    const chatId = createOpaqueId('cht');
    await connection.db
        .insert(usersTable)
        .values({ clerkUserId: createOpaqueId('clk'), id: userId });
    await connection.db.insert(serversTable).values({
        displayName: 'Activity',
        id: serverId,
        slug: `activity-${randomBytes(4).toString('hex')}`,
    });
    await connection.db.insert(serverMembershipsTable).values({
        id: createOpaqueId('mem'),
        role: 'owner',
        serverId,
        userId,
    });
    await connection.db.insert(computersTable).values({
        attachedByUserId: userId,
        credentialHash: randomBytes(32).toString('hex'),
        id: computerId,
        serverId,
    });
    await connection.db.insert(agentsTable).values({
        computerId,
        desiredModelId: 'fake-model',
        desiredRuntimeId: 'fake',
        displayName: 'Ada',
        handle: `ada-${randomBytes(4).toString('hex')}`,
        homeTimezone: 'UTC',
        id: agentId,
        role: 'member',
        serverId,
    });
    await connection.db.insert(chatsTable).values({
        dmAgentId: agentId,
        dmMemberOneStint: 1,
        dmMemberOneUserId: userId,
        id: chatId,
        kind: 'dm',
        serverId,
    });
    return { agentId, chatId, computerId, serverId };
}

async function startRun(seed: Seed) {
    const transport = new FakeTransport();
    transport.online.add(seed.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    await delivery.deliver({
        agentId: seed.agentId,
        chatId: seed.chatId,
        content: 'activity work',
        dedupeKey: createOpaqueId('msg'),
        serverId: seed.serverId,
    });
    const frame = transport.sent.find(
        (item): item is Extract<HostedAgentCommand, { type: 'start' }> => item.type === 'start'
    );
    if (!frame) {
        throw new Error('The test run did not start.');
    }
    return { delivery, frame, transport };
}

function activityFrame(
    seed: Seed,
    runId: string,
    producerSequence: number
): HostedAgentActivityFrame {
    return {
        agentId: seed.agentId,
        category: 'using_tool',
        occurredAt: '2020-01-01T00:00:00.000Z',
        phase: 'started',
        producerSequence,
        runId,
        type: 'agent-activity',
    };
}

function summary(seed: Seed, runId: string): HostedAgentTurnSummary {
    return {
        agentId: seed.agentId,
        endedAt: '2026-08-11T12:00:00.000Z',
        messageCount: 0,
        outputProduced: false,
        runId,
        startedAt: '2026-08-11T11:59:00.000Z',
        status: 'completed',
        summary: 'done',
        type: 'turn',
        visibleMessages: [],
    };
}

test('deduplicates out-of-order Computer frames and interleaves by Server position', async () => {
    const seed = await seedActivity();
    const { frame } = await startRun(seed);
    const first = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 2),
        serverId: seed.serverId,
    });
    const serverEvent = await connection.db.transaction(async (tx) => {
        await lockServerRow(tx, seed.serverId);
        return await appendServerAgentActivity(tx, {
            agentId: seed.agentId,
            category: 'sending_message',
            phase: 'completed',
            runId: frame.runId,
            serverId: seed.serverId,
        });
    });
    const second = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 1),
        serverId: seed.serverId,
    });
    const duplicate = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 2),
        serverId: seed.serverId,
    });
    const duplicateStatus = await recordComputerAgentActivityWithStatus(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 2),
        serverId: seed.serverId,
    });

    expect(first?.position).toBe(2);
    expect(serverEvent?.position).toBe(3);
    expect(second?.position).toBe(4);
    expect(duplicate).toEqual(first);
    expect(duplicateStatus).toEqual({ event: first, inserted: false });
    const rows = await connection.db
        .select({ category: agentActivityTable.category, position: agentActivityTable.position })
        .from(agentActivityTable)
        .where(
            and(
                eq(agentActivityTable.agentId, seed.agentId),
                eq(agentActivityTable.runId, frame.runId)
            )
        )
        .orderBy(asc(agentActivityTable.position));
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4]);
    expect(rows.map((row) => row.category)).toEqual([
        'starting_work',
        'using_tool',
        'sending_message',
        'using_tool',
    ]);

    const firstPage = await listHostedAgentActivityHistory(connection.db, {
        agentId: seed.agentId,
        limit: 2,
        runId: frame.runId,
        serverId: seed.serverId,
    });
    const secondPage = await listHostedAgentActivityHistory(connection.db, {
        agentId: seed.agentId,
        before: firstPage.nextBefore ?? undefined,
        limit: 2,
        runId: frame.runId,
        serverId: seed.serverId,
    });
    expect(firstPage.events.map((event) => event.position)).toEqual([4, 3]);
    expect(secondPage.events.map((event) => event.position)).toEqual([2, 1]);
    expect(secondPage.nextBefore).toBeNull();
});

test('rejects wrong identities and settled runs, while active snapshot recovers the latest event', async () => {
    const seed = await seedActivity();
    const { delivery, frame } = await startRun(seed);
    const wrongComputer = await recordComputerAgentActivity(connection.db, {
        computerId: createOpaqueId('cmp'),
        frame: activityFrame(seed, frame.runId, 1),
        serverId: seed.serverId,
    });
    const wrongAgent = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: { ...activityFrame(seed, frame.runId, 2), agentId: createOpaqueId('agt') },
        serverId: seed.serverId,
    });
    const wrongServer = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 3),
        serverId: createOpaqueId('srv'),
    });
    expect(wrongComputer).toBeNull();
    expect(wrongAgent).toBeNull();
    expect(wrongServer).toBeNull();

    const accepted = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 1),
        serverId: seed.serverId,
    });
    const snapshot = await readHostedActiveAgentActivity(connection.db, seed.serverId);
    expect(snapshot.activities).toHaveLength(1);
    expect(snapshot.activities[0]).toEqual(accepted);

    await delivery.onTurnSettled(seed.computerId, summary(seed, frame.runId));
    const stale = await recordComputerAgentActivity(connection.db, {
        computerId: seed.computerId,
        frame: activityFrame(seed, frame.runId, 4),
        serverId: seed.serverId,
    });
    expect(stale).toBeNull();
    expect((await readHostedActiveAgentActivity(connection.db, seed.serverId)).activities).toEqual(
        []
    );

    const nextRun = await startRun(seed);
    const allRuns = await listHostedAgentActivityHistory(connection.db, {
        agentId: seed.agentId,
        limit: 1,
        serverId: seed.serverId,
    });
    expect(allRuns.events[0]?.runId).toBe(nextRun.frame.runId);
});
