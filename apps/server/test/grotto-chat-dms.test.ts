import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let outsider: GrottoClient;
let peer: GrottoClient;
let ownerServerId: string;
let outsiderUserId: string;
let peerUserId: string;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_dm_owner');
    outsider = await signIn('user_dm_outsider');
    peer = await signIn('user_dm_peer');

    const ownerServer = await owner.trpc.server.create.mutate({
        displayName: 'DM Server',
        slug: 'dm-server',
    });
    await peer.trpc.server.create.mutate({ displayName: 'Peer Root', slug: 'peer-root' });
    await outsider.trpc.server.create.mutate({
        displayName: 'Outsider Root',
        slug: 'outsider-root',
    });
    ownerServerId = ownerServer.id;
    outsiderUserId = await readUserId('user_dm_outsider');
    peerUserId = await readUserId('user_dm_peer');

    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values
            ('mem_dm_peer', ${ownerServerId}, ${peerUserId}, 'member'),
            ('mem_dm_outsider', ${ownerServerId}, ${outsiderUserId}, 'member')
    `;
});

afterAll(async () => {
    owner.close();
    outsider.close();
    peer.close();
    await harness.close();
});

test('DM access and rows fail closed across participants and Servers', async () => {
    const ownerUserId = await readUserId('user_dm_owner');
    const dm = await owner.trpc.chat.ensureDm.mutate({
        peerUserId,
        serverId: ownerServerId,
    });
    const outsiderServer = await outsider.trpc.server.bySlug.query({ slug: 'outsider-root' });

    await expect(
        outsider.trpc.chat.messages.query({ chatId: dm.id, serverId: ownerServerId })
    ).rejects.toThrow(/participant/i);
    await expect(
        owner.trpc.chat.messages.query({ chatId: dm.id, serverId: outsiderServer.id })
    ).rejects.toThrow();

    const crossServerInsert = harness.sql`
        insert into chat_messages (
            id, server_id, chat_id, sequence, author_user_id, content, nonce
        ) values (
            'msg_cross_server_denied',
            ${outsiderServer.id},
            ${dm.id},
            1,
            ${ownerUserId},
            'must fail',
            'cross-server-denied'
        )
    `;
    let insertError: unknown;
    try {
        await crossServerInsert;
    } catch (error) {
        insertError = error;
    }
    expect(insertError).toBeInstanceOf(Error);
    expect((insertError as Error).message).toMatch(/foreign key/i);
});

test('a DM has one canonical sorted member pair and no duplicated participant rows', async () => {
    const ownerDm = await owner.trpc.chat.ensureDm.mutate({
        peerUserId,
        serverId: ownerServerId,
    });
    const ownerUserId = await readUserId('user_dm_owner');
    const peerDm = await peer.trpc.chat.ensureDm.mutate({
        peerUserId: ownerUserId,
        serverId: ownerServerId,
    });

    expect(peerDm.id).toBe(ownerDm.id);
    expect(ownerDm).toMatchObject({ kind: 'dm', serverId: ownerServerId });

    const pairs = (await harness.sql`
        select dm_member_one_user_id, dm_member_two_user_id
        from chats where server_id = ${ownerServerId} and id = ${ownerDm.id}
    `) as { dm_member_one_user_id: string; dm_member_two_user_id: string }[];

    expect(pairs).toEqual([
        {
            dm_member_one_user_id: [ownerUserId, peerUserId].sort()[0],
            dm_member_two_user_id: [ownerUserId, peerUserId].sort()[1],
        },
    ]);
    const participants = await harness.sql`
        select count(*)::int as total from channel_participants
        where server_id = ${ownerServerId} and chat_id = ${ownerDm.id}
    `;
    expect(participants).toEqual([{ total: 0 }]);
});

test('opening an existing DM returns its current peer identity and unread count', async () => {
    const dm = await owner.trpc.chat.ensureDm.mutate({
        peerUserId,
        serverId: ownerServerId,
    });
    const sent = await owner.trpc.chat.send.mutate({
        chatId: dm.id,
        content: 'Unread DM',
        nonce: 'dm-unread',
        serverId: ownerServerId,
    });
    if (sent.message.author.kind !== 'human') {
        throw new Error('A human DM send must retain its human author.');
    }
    const reopened = await peer.trpc.chat.ensureDm.mutate({
        peerUserId: sent.message.author.userId,
        serverId: ownerServerId,
    });

    expect(reopened).toMatchObject({
        id: dm.id,
        peerUserId: sent.message.author.userId,
        unreadCount: 1,
    });
});

test('a revoked member cannot be opened as a DM peer', async () => {
    await harness.sql`
        update server_memberships set revoked_at = now()
        where server_id = ${ownerServerId} and user_id = ${peerUserId}
    `;

    await expect(
        owner.trpc.chat.ensureDm.mutate({
            peerUserId,
            serverId: ownerServerId,
        })
    ).rejects.toThrow(/not a member/i);
});

async function signIn(clerkUserId: string) {
    const token = await harness.clerk.mintSessionToken(clerkUserId);
    return createGrottoClient(harness, token);
}

async function readUserId(clerkUserId: string) {
    const rows = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];

    return rows[0].id;
}
