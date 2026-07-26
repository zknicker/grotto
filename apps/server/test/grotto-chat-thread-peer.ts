import { createGrottoClient } from './grotto-client.ts';
import type { GrottoServerHarness } from './grotto-server-harness.ts';

export async function addThreadPeerToChannel(
    harness: GrottoServerHarness,
    serverId: string,
    chatId: string
) {
    const peerToken = await harness.clerk.mintSessionToken('user_thread_peer');
    const client = createGrottoClient(harness, peerToken);
    await client.trpc.server.create.mutate({
        displayName: 'Thread Peer Root',
        slug: 'thread-peer-root',
    });
    const [{ id: peerUserId }] = (await harness.sql`
        select id from users where clerk_user_id = 'user_thread_peer'
    `) as { id: string }[];
    const [{ id: ownerUserId }] = (await harness.sql`
        select id from users where clerk_user_id = 'user_thread_owner'
    `) as { id: string }[];
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_thread_peer', ${serverId}, ${peerUserId}, 'member')
    `;
    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${chatId}, ${peerUserId})
    `;
    return { client, ownerUserId };
}
