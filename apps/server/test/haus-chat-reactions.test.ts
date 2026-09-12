import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { ServerDurableEvent } from '@haus/api';
import { createHausClient, type HausClient } from './haus-client.ts';
import { type HausServerHarness, startHausServerHarness } from './haus-server-harness.ts';

let harness: HausServerHarness;
let owner: HausClient;
let peer: HausClient;
let outsider: HausClient;
let ownerUserId: string;
let peerUserId: string;
let serverId: string;
let chatId: string;
beforeAll(async () => {
    harness = await startHausServerHarness();
    owner = await signIn('user_reactions_owner');
    peer = await signIn('user_reactions_peer');
    outsider = await signIn('user_reactions_outsider');

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Reaction Server',
        slug: 'reaction-server',
    });
    serverId = server.id;
    chatId = server.channels[0].id;
    await peer.trpc.server.create.mutate({
        displayName: 'Reaction Peer Root',
        slug: 'reaction-peer-root',
    });
    await outsider.trpc.server.create.mutate({
        displayName: 'Reaction Outsider Root',
        slug: 'reaction-outsider-root',
    });

    ownerUserId = await readUserId('user_reactions_owner');
    peerUserId = await readUserId('user_reactions_peer');
    const outsiderUserId = await readUserId('user_reactions_outsider');
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values
            ('mem_reactions_peer', ${serverId}, ${peerUserId}, 'member'),
            ('mem_reactions_outsider', ${serverId}, ${outsiderUserId}, 'member')
    `;
    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${chatId}, ${peerUserId})
    `;
});
afterAll(async () => {
    owner.close();
    peer.close();
    outsider.close();
    await harness.close();
});
test('human reactions persist, group by emoji, hydrate for a fresh client, and sync live', async () => {
    const sent = await owner.trpc.chat.send.mutate({
        chatId,
        content: 'Durable reaction target',
        nonce: 'reaction-target',
        serverId,
    });
    const subscription = subscribeToChatEvents(peer, serverId);
    await subscription.started;
    const added = await owner.trpc.chat.react.mutate({
        emoji: '👍',
        messageId: sent.message.id,
        serverId,
    });
    expect(added).toMatchObject({
        changed: true,
        eventCursor: expect.stringMatching(/^[1-9]\d*$/u),
        message: {
            id: sent.message.id,
            reactions: [
                {
                    actors: [{ handle: null, id: ownerUserId, kind: 'human' }],
                    emoji: '👍',
                },
            ],
        },
    });
    await expect(subscription.nextEvent).resolves.toMatchObject({
        chatId,
        messageId: sent.message.id,
        parentChatId: null,
        serverId,
        type: 'message.reaction.updated',
    });
    const freshClient = await signIn('user_reactions_peer');
    try {
        await expect(
            freshClient.trpc.chat.messages.query({ chatId, serverId })
        ).resolves.toMatchObject({
            messages: [
                expect.objectContaining({
                    id: sent.message.id,
                    reactions: [
                        expect.objectContaining({
                            actors: [expect.objectContaining({ id: ownerUserId, kind: 'human' })],
                            emoji: '👍',
                        }),
                    ],
                }),
            ],
        });
        await expect(
            freshClient.trpc.chat.search.query({ query: 'Durable reaction target', serverId })
        ).resolves.toMatchObject([
            expect.objectContaining({
                id: sent.message.id,
                reactions: [expect.objectContaining({ emoji: '👍' })],
            }),
        ]);
    } finally {
        freshClient.close();
    }
    const peerAdded = await peer.trpc.chat.react.mutate({
        emoji: '👍',
        messageId: sent.message.id,
        serverId,
    });
    expect(peerAdded.changed).toBe(true);
    const grouped = await owner.trpc.chat.messages.query({ chatId, serverId });
    const groupedReaction = grouped.messages[0]?.reactions.find(({ emoji }) => emoji === '👍');
    expect(groupedReaction?.actors.map(({ id }) => id).sort()).toEqual(
        [ownerUserId, peerUserId].sort()
    );
    const duplicate = await owner.trpc.chat.react.mutate({
        emoji: '👍',
        messageId: sent.message.id,
        serverId,
    });
    expect(duplicate).toMatchObject({ changed: false, eventCursor: null });
    const ownerRemoved = await owner.trpc.chat.react.mutate({
        emoji: '👍',
        messageId: sent.message.id,
        remove: true,
        serverId,
    });
    expect(ownerRemoved.changed).toBe(true);
    await expect(peer.trpc.chat.messages.query({ chatId, serverId })).resolves.toMatchObject({
        messages: [
            expect.objectContaining({
                id: sent.message.id,
                reactions: [
                    expect.objectContaining({
                        actors: [expect.objectContaining({ id: peerUserId, kind: 'human' })],
                        emoji: '👍',
                    }),
                ],
            }),
        ],
    });
    await peer.trpc.chat.react.mutate({
        emoji: '👍',
        messageId: sent.message.id,
        remove: true,
        serverId,
    });
    await expect(owner.trpc.chat.messages.query({ chatId, serverId })).resolves.toMatchObject({
        messages: [expect.objectContaining({ id: sent.message.id, reactions: [] })],
    });
    const noOpRemove = await peer.trpc.chat.react.mutate({
        emoji: '👍',
        messageId: sent.message.id,
        remove: true,
        serverId,
    });
    expect(noOpRemove).toMatchObject({
        changed: false,
        eventCursor: null,
        message: { reactions: [] },
    });
    await expect(
        outsider.trpc.chat.events.query({ afterCursor: sent.eventCursor, serverId })
    ).resolves.toEqual([]);
});

test('reaction writes preserve Thread access and archived lifecycle guards', async () => {
    const anchor = await owner.trpc.chat.send.mutate({
        chatId,
        content: 'Thread reaction anchor',
        nonce: 'reaction-thread-anchor',
        serverId,
    });
    const reply = await peer.trpc.chat.send.mutate({
        chatId,
        content: 'Thread reaction reply',
        nonce: 'reaction-thread-reply',
        serverId,
        thread: { anchorMessageId: anchor.message.id },
    });
    const threadChatId = reply.threadChatId;
    if (!threadChatId) {
        throw new Error('Expected the reaction fixture to materialize a Thread.');
    }

    const subscription = subscribeToChatEvents(owner, serverId);
    await subscription.started;
    const reacted = await peer.trpc.chat.react.mutate({
        emoji: '🎉',
        messageId: reply.message.id,
        serverId,
    });
    expect(reacted.changed).toBe(true);
    await expect(subscription.nextEvent).resolves.toMatchObject({
        chatId: threadChatId,
        messageId: reply.message.id,
        parentChatId: chatId,
        type: 'message.reaction.updated',
    });
    await expect(
        owner.trpc.chat.messages.query({ chatId: threadChatId, serverId })
    ).resolves.toMatchObject({
        messages: [
            expect.objectContaining({
                id: reply.message.id,
                reactions: [
                    expect.objectContaining({
                        actors: [expect.objectContaining({ id: peerUserId, kind: 'human' })],
                        emoji: '🎉',
                    }),
                ],
            }),
        ],
    });

    await expect(
        outsider.trpc.chat.react.mutate({
            emoji: '🎉',
            messageId: reply.message.id,
            serverId,
        })
    ).rejects.toThrow(/participant/i);

    const archivedChannelId = 'cht_reaction_archive';
    await harness.sql`
        insert into chats (id, server_id, kind, name)
        values (${archivedChannelId}, ${serverId}, 'channel', 'reaction-archive')
    `;
    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${archivedChannelId}, ${ownerUserId})
    `;
    const archivedMessage = await owner.trpc.chat.send.mutate({
        chatId: archivedChannelId,
        content: 'Archived reaction target',
        nonce: 'reaction-archived-target',
        serverId,
    });
    await owner.trpc.chat.archiveChannel.mutate({ chatId: archivedChannelId, serverId });
    await expect(
        owner.trpc.chat.react.mutate({
            emoji: '👀',
            messageId: archivedMessage.message.id,
            serverId,
        })
    ).rejects.toThrow(/archived/i);
});

async function signIn(clerkUserId: string) {
    return createHausClient(harness, await harness.clerk.mintSessionToken(clerkUserId));
}

async function readUserId(clerkUserId: string) {
    const [user] = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];
    if (!user) {
        throw new Error(`Missing test user ${clerkUserId}.`);
    }
    return user.id;
}

function subscribeToChatEvents(client: HausClient, subscribedServerId: string) {
    const started = Promise.withResolvers<void>();
    const nextEvent = Promise.withResolvers<ServerDurableEvent>();
    const timeout = setTimeout(() => {
        nextEvent.reject(new Error('Timed out waiting for a durable reaction event.'));
    }, 5000);
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
    return { nextEvent: nextEvent.promise, started: started.promise };
}
