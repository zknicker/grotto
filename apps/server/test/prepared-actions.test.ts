import { afterAll, beforeAll, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { recordExactMessagesServed } from '../src/agent-delivery/cursors.ts';
import type { AgentDelivery } from '../src/agent-delivery/delivery.ts';
import type { ResolvedRunner } from '../src/computers/runner-credentials.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createOpaqueId } from '../src/postgres/opaque-id.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatMessagesTable,
    chatsTable,
    preparedActionMediaTable,
    preparedActionsTable,
    serverMembershipsTable,
    serversTable,
    usersTable,
} from '../src/postgres/schema.ts';
import {
    PreparedActionConflictError,
    PreparedActionStaleViewError,
    prepareAgentAction,
} from '../src/prepared-actions/prepare.ts';
import {
    readPreparedAction,
    readPreparedActionsForMessages,
} from '../src/prepared-actions/read.ts';
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

test('persists immutable action media, supersedes only the same proposer, and rejects stale views', async () => {
    const seed = await seedActionChat();
    const runnerOne = runner(seed, seed.agentOneId, 'run_one');
    const runnerTwo = runner(seed, seed.agentTwoId, 'run_two');
    const delivery = fakeDelivery();
    const firstAvatar = avatar([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const secondAvatar = avatar([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    await recordExactMessagesServed(connection.db, {
        agentId: seed.agentOneId,
        messages: [{ chatId: seed.chatId, id: seed.humanMessageId }],
        runId: runnerOne.runId,
        serverId: seed.serverId,
    });
    const first = await prepareAgentAction(
        connection.db,
        runnerOne,
        {
            action: action('Orbit'),
            avatar: firstAvatar,
            nonce: 'one-first',
            target: '#product',
        },
        delivery.value
    );

    expect(first.receipt.idempotent).toBe(false);
    expect(first.receipt.action.status).toBe('pending');
    expect(first.events.map(({ type }) => type)).toEqual([
        'message.created',
        'prepared-action.updated',
    ]);

    const replay = await prepareAgentAction(
        connection.db,
        runnerOne,
        {
            action: action('Orbit'),
            avatar: firstAvatar,
            nonce: 'one-first',
            target: '#product',
        },
        delivery.value
    );
    expect(replay.receipt.idempotent).toBe(true);
    expect(replay.events).toHaveLength(0);
    expect(replay.receipt.action.id).toBe(first.receipt.action.id);

    await expect(
        prepareAgentAction(
            connection.db,
            runnerOne,
            {
                action: action('Different'),
                avatar: firstAvatar,
                nonce: 'one-first',
                target: '#product',
            },
            delivery.value
        )
    ).rejects.toBeInstanceOf(PreparedActionConflictError);

    const second = await prepareAgentAction(
        connection.db,
        runnerOne,
        {
            action: action('Orbit Revised'),
            avatar: secondAvatar,
            nonce: 'one-second',
            target: '#product',
        },
        delivery.value
    );
    expect(second.receipt.action.status).toBe('pending');
    expect(second.events.map(({ type }) => type)).toEqual([
        'prepared-action.updated',
        'message.created',
        'prepared-action.updated',
    ]);

    const firstStored = await readPreparedAction(
        connection.db,
        seed.serverId,
        first.receipt.action.id
    );
    expect(firstStored?.status).toBe('superseded');
    expect(firstStored?.supersededByActionId).toBe(second.receipt.action.id);
    expect(firstStored?.kind).toBe('agent:create');

    const firstMedia = await connection.db
        .select({ bytes: preparedActionMediaTable.bytes })
        .from(preparedActionMediaTable)
        .where(eq(preparedActionMediaTable.actionId, first.receipt.action.id));
    expect(Buffer.from(firstMedia[0]?.bytes ?? []).equals(Buffer.from(firstAvatar.bytes))).toBe(
        true
    );

    await recordExactMessagesServed(connection.db, {
        agentId: seed.agentTwoId,
        messages: [
            { chatId: seed.chatId, id: seed.humanMessageId },
            { chatId: seed.chatId, id: first.receipt.messageId },
            { chatId: seed.chatId, id: second.receipt.messageId },
        ],
        runId: runnerTwo.runId,
        serverId: seed.serverId,
    });
    const competing = await prepareAgentAction(
        connection.db,
        runnerTwo,
        {
            action: action('Scout'),
            avatar: firstAvatar,
            nonce: 'two-first',
            target: '#product',
        },
        delivery.value
    );
    expect(competing.receipt.action.status).toBe('pending');
    expect(
        (await readPreparedAction(connection.db, seed.serverId, second.receipt.action.id))?.status
    ).toBe('pending');

    const projected = await readPreparedActionsForMessages(connection.db, seed.serverId, [
        first.receipt.messageId,
        second.receipt.messageId,
        competing.receipt.messageId,
    ]);
    expect(projected.get(first.receipt.messageId)?.status).toBe('superseded');
    expect(projected.get(second.receipt.messageId)?.proposal.name).toBe('Orbit Revised');
    expect(projected.get(competing.receipt.messageId)?.proposal.name).toBe('Scout');

    await addHumanMessage(seed, 5);
    await expect(
        prepareAgentAction(
            connection.db,
            runnerOne,
            {
                action: action('Too Late'),
                avatar: firstAvatar,
                nonce: 'one-stale',
                target: '#product',
            },
            delivery.value
        )
    ).rejects.toBeInstanceOf(PreparedActionStaleViewError);

    const statuses = await connection.db
        .select({
            id: preparedActionsTable.id,
            proposerAgentId: preparedActionsTable.proposerAgentId,
            status: preparedActionsTable.status,
        })
        .from(preparedActionsTable)
        .where(eq(preparedActionsTable.serverId, seed.serverId));
    expect(statuses).toEqual(
        expect.arrayContaining([
            { id: first.receipt.action.id, proposerAgentId: seed.agentOneId, status: 'superseded' },
            { id: second.receipt.action.id, proposerAgentId: seed.agentOneId, status: 'pending' },
            {
                id: competing.receipt.action.id,
                proposerAgentId: seed.agentTwoId,
                status: 'pending',
            },
        ])
    );
});

interface ActionSeed {
    agentOneId: string;
    agentTwoId: string;
    chatId: string;
    humanMessageId: string;
    serverId: string;
}

async function seedActionChat(): Promise<ActionSeed> {
    const serverId = createOpaqueId('srv');
    const chatId = createOpaqueId('cht');
    const userId = createOpaqueId('usr');
    const agentOneId = createOpaqueId('agt');
    const agentTwoId = createOpaqueId('agt');
    const humanMessageId = createOpaqueId('msg');
    await connection.db
        .insert(usersTable)
        .values({ clerkUserId: createOpaqueId('clk'), id: userId });
    await connection.db.insert(serversTable).values({
        displayName: 'Prepared actions',
        id: serverId,
        slug: `prepared-${serverId.slice(-8)}`,
    });
    await connection.db.insert(serverMembershipsTable).values({
        id: createOpaqueId('mem'),
        role: 'owner',
        serverId,
        userId,
    });
    await connection.db
        .insert(agentsTable)
        .values([
            agentRow(agentOneId, serverId, 'builder'),
            agentRow(agentTwoId, serverId, 'scout'),
        ]);
    await connection.db.insert(chatsTable).values({
        id: chatId,
        kind: 'channel',
        name: 'product',
        serverId,
    });
    await connection.db.insert(channelAgentParticipantsTable).values([
        { agentId: agentOneId, chatId, serverId },
        { agentId: agentTwoId, chatId, serverId },
    ]);
    await connection.db
        .update(chatsTable)
        .set({ lastMessageSequence: 1 })
        .where(eq(chatsTable.id, chatId));
    await connection.db.insert(chatMessagesTable).values({
        authorUserId: userId,
        chatId,
        content: 'Build an Agent for the release.',
        id: humanMessageId,
        nonce: 'human-seed',
        sequence: 1,
        serverId,
    });
    return { agentOneId, agentTwoId, chatId, humanMessageId, serverId };
}

function agentRow(id: string, serverId: string, handle: string) {
    return {
        displayName: handle,
        handle: `${handle}-${id.slice(-4)}`,
        homeTimezone: 'UTC',
        id,
        role: 'member' as const,
        serverId,
    };
}

function runner(seed: ActionSeed, agentId: string, runId: string): ResolvedRunner {
    return {
        agentId,
        capabilities: [],
        chatId: seed.chatId,
        computerId: createOpaqueId('cmp'),
        runId,
        runnerId: createOpaqueId('arc'),
        serverId: seed.serverId,
    };
}

function action(name: string) {
    return {
        computer: null,
        description: `Description for ${name}`,
        draftHint: null,
        kind: 'agent:create' as const,
        name,
    };
}

function avatar(bytes: number[]): { bytes: Uint8Array; mediaType: 'image/png' } {
    const value = Uint8Array.from(bytes);
    return {
        bytes: value,
        mediaType: 'image/png',
    };
}

function fakeDelivery() {
    const calls: string[] = [];
    return {
        calls,
        value: {
            enqueue: async (_db: unknown, input: { agentId: string }) => {
                calls.push(input.agentId);
            },
        } as unknown as AgentDelivery,
    };
}

async function addHumanMessage(seed: ActionSeed, sequence: number) {
    const messageId = createOpaqueId('msg');
    await connection.db
        .update(chatsTable)
        .set({ lastMessageSequence: sequence })
        .where(and(eq(chatsTable.serverId, seed.serverId), eq(chatsTable.id, seed.chatId)));
    const [user] = await connection.db
        .select({ userId: serverMembershipsTable.userId })
        .from(serverMembershipsTable)
        .where(eq(serverMembershipsTable.serverId, seed.serverId))
        .limit(1);
    await connection.db.insert(chatMessagesTable).values({
        authorUserId: user.userId,
        chatId: seed.chatId,
        content: 'A human changed the brief.',
        id: messageId,
        nonce: `human-${sequence}`,
        sequence,
        serverId: seed.serverId,
    });
}
