import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let chatId: string;
let serverId: string;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_events_owner');
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Events Server',
        slug: 'events-server',
    });
    chatId = server.channels[0].id;
    serverId = server.id;
});

afterAll(async () => {
    owner.close();
    await harness.close();
});

test('durable cursors catch up messages sent while realtime is disconnected', async () => {
    const first = await send('durable first', 'durable-event-1');
    const initial = await owner.trpc.chat.events.query({ afterCursor: '0', serverId });
    expect(initial).toMatchObject([
        {
            chatId,
            cursor: first.eventCursor,
            messageId: first.message.id,
            serverId,
            type: 'message.created',
        },
    ]);

    const subscription = subscribeToChatEvents(owner, serverId);
    await subscription.started;
    const live = await send('durable live', 'durable-event-2');
    await expect(subscription.nextEvent).resolves.toMatchObject({
        cursor: live.eventCursor,
        messageId: live.message.id,
    });

    const disconnected = await send('durable reconnect', 'durable-event-3');
    const catchUp = await owner.trpc.chat.events.query({
        afterCursor: live.eventCursor,
        serverId,
    });
    expect(catchUp).toMatchObject([
        {
            cursor: disconnected.eventCursor,
            messageId: disconnected.message.id,
            type: 'message.created',
        },
    ]);
    await expect(owner.trpc.chat.eventHead.query({ serverId })).resolves.toEqual({
        cursor: disconnected.eventCursor,
    });
});

test('event delivery skips an inaccessible Chat without terminating the Server feed', async () => {
    const peer = await signIn('user_events_filter_peer');
    await peer.trpc.server.create.mutate({
        displayName: 'Filter Peer Root',
        slug: 'events-filter-peer',
    });
    const [peerUser] = (await harness.sql`
        select id from users where clerk_user_id = 'user_events_filter_peer'
    `) as { id: string }[];
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_events_filter_peer', ${serverId}, ${peerUser.id}, 'member')
    `;

    const subscription = subscribeToChatEvents(peer, serverId);
    await subscription.started;
    await send('not visible to peer', 'durable-event-filtered');
    await subscription.expectNoEventFor(100);

    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${chatId}, ${peerUser.id})
    `;
    const visible = await send('visible after joining', 'durable-event-visible');

    await expect(subscription.nextEvent).resolves.toMatchObject({
        messageId: visible.message.id,
    });
    peer.close();
});

test('event subscription rechecks persisted membership revocation after the author speaks', async () => {
    const peer = await signIn('user_events_peer');
    await peer.trpc.server.create.mutate({ displayName: 'Peer Root', slug: 'events-peer' });
    const [peerUser] = (await harness.sql`
        select id from users where clerk_user_id = 'user_events_peer'
    `) as { id: string }[];
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_events_peer', ${serverId}, ${peerUser.id}, 'member')
    `;
    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${chatId}, ${peerUser.id})
    `;

    await peer.trpc.chat.send.mutate({
        chatId,
        content: 'history survives revocation',
        nonce: 'durable-event-peer-history',
        serverId,
    });
    const subscription = subscribeToChatEvents(peer, serverId);
    await subscription.started;
    await harness.sql`
        update server_memberships set revoked_at = now()
        where server_id = ${serverId} and user_id = ${peerUser.id}
    `;
    await within(
        send('membership was revoked', 'durable-event-revoked'),
        'sending after membership revocation'
    );

    await expect(within(subscription.nextEvent, 'receiving the revocation error')).rejects.toThrow(
        /member/i
    );
    await expect(
        within(peer.trpc.server.list.query(), 'listing Servers after revocation')
    ).resolves.not.toContainEqual(expect.objectContaining({ id: serverId }));
    await expect(
        within(
            harness.sql`
                select content from chat_messages
                where server_id = ${serverId} and author_user_id = ${peerUser.id}
            `,
            'reading history after revocation'
        )
    ).resolves.toEqual([{ content: 'history survives revocation' }]);
    peer.close();
});

test('queries, mutations, and subscriptions reject a human from another Server', async () => {
    const outsider = await signIn('user_events_outsider');
    await outsider.trpc.server.create.mutate({
        displayName: 'Outsider Root',
        slug: 'events-outsider',
    });

    await expect(outsider.trpc.chat.events.query({ afterCursor: '0', serverId })).rejects.toThrow(
        /member/i
    );
    await expect(outsider.trpc.chat.eventHead.query({ serverId })).rejects.toThrow(/member/i);
    await expect(outsider.trpc.chat.search.query({ query: 'durable', serverId })).rejects.toThrow(
        /member/i
    );
    await expect(
        outsider.trpc.chat.send.mutate({
            chatId,
            content: 'cross-Server write',
            nonce: 'cross-server-write',
            serverId,
        })
    ).rejects.toThrow(/member/i);

    const subscription = subscribeToChatEvents(outsider, serverId);
    await expect(subscription.started).rejects.toThrow(/member/i);
    outsider.close();
});

function send(content: string, nonce: string) {
    return owner.trpc.chat.send.mutate({ chatId, content, nonce, serverId });
}

const subscriptionTimeoutMs = 5000;

function subscribeToChatEvents(client: GrottoClient, subscribedServerId: string) {
    const started = Promise.withResolvers<void>();
    const nextEvent = Promise.withResolvers<unknown>();
    const timeout = setTimeout(() => {
        nextEvent.reject(new Error('Timed out waiting for a durable Chat event.'));
    }, subscriptionTimeoutMs);
    const subscription = client.trpc.chat.onEvent.subscribe(
        { serverId: subscribedServerId },
        {
            onData: (event) => {
                clearTimeout(timeout);
                subscription.unsubscribe();
                nextEvent.resolve(event);
            },
            onError: (error) => {
                clearTimeout(timeout);
                started.reject(error);
                nextEvent.reject(error);
            },
            onStarted: () => started.resolve(),
        }
    );

    started.promise.catch(() => undefined);
    nextEvent.promise.catch(() => undefined);
    return {
        expectNoEventFor: async (milliseconds: number) => {
            await Promise.race([
                nextEvent.promise.then(() => {
                    throw new Error('Received a durable Chat event for an inaccessible Chat.');
                }),
                Bun.sleep(milliseconds),
            ]);
        },
        nextEvent: nextEvent.promise,
        started: started.promise,
    };
}

async function signIn(clerkUserId: string) {
    const token = await harness.clerk.mintSessionToken(clerkUserId);
    return createGrottoClient(harness, token);
}

async function within<T>(promise: Promise<T>, step: string): Promise<T> {
    return await Promise.race([
        promise,
        Bun.sleep(2000).then(() => {
            throw new Error(`Timed out ${step}.`);
        }),
    ]);
}
