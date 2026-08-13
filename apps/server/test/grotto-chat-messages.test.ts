import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let client: GrottoClient;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    const token = await harness.clerk.mintSessionToken('user_hosted_messages');
    client = createGrottoClient(harness, token);
});

afterAll(async () => {
    client.close();
    await harness.close();
});

test('a human sends an immutable message to #all and reads it back by sequence', async () => {
    const server = await client.trpc.server.create.mutate({
        displayName: 'Message Server',
        slug: 'message-server',
    });
    const chatId = server.channels[0].id;

    const sent = await client.trpc.chat.send.mutate({
        chatId,
        content: 'Hello from Grotto.',
        nonce: 'message-send-1',
        serverId: server.id,
    });

    expect(sent).toMatchObject({
        idempotent: false,
        message: {
            chatId,
            content: 'Hello from Grotto.',
            nonce: 'message-send-1',
            sequence: 1,
            serverId: server.id,
        },
    });

    await expect(
        client.trpc.chat.messages.query({ chatId, serverId: server.id })
    ).resolves.toMatchObject({
        messages: [{ id: sent.message.id, sequence: 1 }],
        nextBeforeSequence: null,
    });
});

test('concurrent sends allocate one stable sequence per nonce', async () => {
    const server = await client.trpc.server.bySlug.query({ slug: 'message-server' });
    const chatId = server.channels[0].id;
    const sends = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
            client.trpc.chat.send.mutate({
                chatId,
                content: `Concurrent ${index + 1}`,
                nonce: `concurrent-${index + 1}`,
                serverId: server.id,
            })
        )
    );

    expect(
        sends.map((receipt) => receipt.message.sequence).sort((left, right) => left - right)
    ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

    const retries = await Promise.all(
        Array.from({ length: 4 }, () =>
            client.trpc.chat.send.mutate({
                chatId,
                content: 'One logical retry.',
                nonce: 'same-logical-send',
                serverId: server.id,
            })
        )
    );

    expect(new Set(retries.map((receipt) => receipt.message.id)).size).toBe(1);
    expect(retries.filter((receipt) => !receipt.idempotent)).toHaveLength(1);
    expect(retries.map((receipt) => receipt.message.sequence)).toEqual([14, 14, 14, 14]);

    await expect(
        client.trpc.chat.send.mutate({
            chatId,
            content: 'Different content.',
            nonce: 'same-logical-send',
            serverId: server.id,
        })
    ).rejects.toThrow(/different send/i);

    await expect(
        client.trpc.chat.messages.query({ chatId, limit: 14, serverId: server.id })
    ).resolves.toMatchObject({ nextBeforeSequence: null });
    await expect(
        client.trpc.chat.messages.query({ chatId, limit: 5, serverId: server.id })
    ).resolves.toMatchObject({
        messages: [
            { sequence: 10 },
            { sequence: 11 },
            { sequence: 12 },
            { sequence: 13 },
            { sequence: 14 },
        ],
        nextBeforeSequence: 10,
    });
});

test('the Server row serializes durable cursor allocation through commit', async () => {
    const server = await client.trpc.server.bySlug.query({ slug: 'message-server' });
    const chatId = server.channels[0].id;
    const [{ user_id: userId }] = (await harness.sql`
        select user_id from server_memberships
        where server_id = ${server.id} and revoked_at is null
    `) as { user_id: string }[];
    const firstAllocated = Promise.withResolvers<bigint>();
    const releaseFirst = Promise.withResolvers<void>();
    const commitOrder: bigint[] = [];

    const first = harness.sql
        .begin(async (tx) => {
            const [{ cursor }] = (await tx`
                update servers
                set last_chat_event_cursor = last_chat_event_cursor + 1
                where id = ${server.id}
                returning last_chat_event_cursor as cursor
            `) as { cursor: bigint }[];
            firstAllocated.resolve(BigInt(cursor));
            await releaseFirst.promise;
            await tx`
                insert into chat_events (
                    cursor, id, server_id, chat_id, event_type, reader_user_id, sequence
                ) values (
                    ${cursor}, 'evt_commit_first', ${server.id}, ${chatId},
                    'chat.read', ${userId}, 0
                )
            `;
            return BigInt(cursor);
        })
        .then((cursor) => commitOrder.push(cursor));

    const firstCursor = await firstAllocated.promise;
    const second = harness.sql
        .begin(async (tx) => {
            const [{ cursor }] = (await tx`
                update servers
                set last_chat_event_cursor = last_chat_event_cursor + 1
                where id = ${server.id}
                returning last_chat_event_cursor as cursor
            `) as { cursor: bigint }[];
            await tx`
                insert into chat_events (
                    cursor, id, server_id, chat_id, event_type, reader_user_id, sequence
                ) values (
                    ${cursor}, 'evt_commit_second', ${server.id}, ${chatId},
                    'chat.read', ${userId}, 0
                )
            `;
            return BigInt(cursor);
        })
        .then((cursor) => commitOrder.push(cursor));

    await Bun.sleep(50);
    expect(commitOrder).toEqual([]);
    releaseFirst.resolve();
    await Promise.all([first, second]);

    expect(commitOrder).toEqual([firstCursor, firstCursor + 1n]);
    const events = (await harness.sql`
        select id, cursor from chat_events
        where id in ('evt_commit_first', 'evt_commit_second')
        order by cursor
    `) as { cursor: string; id: string }[];
    expect(events).toEqual([
        { cursor: firstCursor.toString(), id: 'evt_commit_first' },
        { cursor: (firstCursor + 1n).toString(), id: 'evt_commit_second' },
    ]);
});

test('durable cursor sequences are independent across Servers', async () => {
    const server = await client.trpc.server.create.mutate({
        displayName: 'Second Message Server',
        slug: 'second-message-server',
    });
    const receipt = await client.trpc.chat.send.mutate({
        chatId: server.channels[0].id,
        content: 'First event in another Server.',
        nonce: 'second-server-first-event',
        serverId: server.id,
    });

    expect(receipt.eventCursor).toBe('1');
});
