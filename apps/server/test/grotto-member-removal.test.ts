import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

/**
 * Removal revokes access immediately and clears the hosted personal work a
 * human holds today — their Channel participation and read markers. What they
 * authored stays theirs, and the membership row survives as the anchor those
 * records point at.
 */
let harness: GrottoServerHarness;
let owner: GrottoClient;
let serverId: string;
let allChatId: string;
const slug = 'removal-hq';

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_removal_owner', ['removal-owner@grotto.test']);

    const created = await owner.trpc.server.create.mutate({ displayName: 'Removal HQ', slug });
    serverId = created.id;
    allChatId = created.channels[0].id;
});

afterAll(async () => {
    await harness.close();
});

test('a removed human loses access at once while their authorship remains', async () => {
    const leaver = await signIn('user_removal_leaver', ['removal-leaver@grotto.test']);
    await join(leaver, 'removal-leaver@grotto.test');
    const leaverUserId = await readUserId('user_removal_leaver');

    await leaver.trpc.chat.send.mutate({
        chatId: allChatId,
        content: 'Authored before removal',
        nonce: 'removal-1',
        serverId,
    });
    await leaver.trpc.chat.markRead.mutate({ chatId: allChatId, sequence: 1, serverId });
    const dm = await leaver.trpc.chat.ensureDm.mutate({
        peerUserId: await readUserId('user_removal_owner'),
        serverId,
    });

    await owner.trpc.member.remove.mutate({
        confirmation: slug,
        serverId,
        userId: leaverUserId,
    });

    await expect(leaver.trpc.server.bySlug.query({ slug })).rejects.toThrow(/not a member/i);
    await expect(leaver.trpc.chat.list.query({ serverId })).rejects.toThrow(/not a member/i);
    await expect(
        leaver.trpc.chat.send.mutate({
            chatId: allChatId,
            content: 'After removal',
            nonce: 'removal-2',
            serverId,
        })
    ).rejects.toThrow(/not a member/i);

    const directory = await owner.trpc.member.list.query({ serverId });
    expect(directory.members.map((entry) => entry.userId)).not.toContain(leaverUserId);

    // Authorship and the DM they took part in are collaboration history.
    const messages = await owner.trpc.chat.messages.query({ chatId: allChatId, serverId });
    expect(messages.messages.map((message) => message.content)).toContain(
        'Authored before removal'
    );
    expect(messages.messages.at(0)?.author).toMatchObject({
        kind: 'human',
        profile: { deleted: true },
        userId: leaverUserId,
    });

    const [dmRow] = await harness.sql`
        select count(*)::int as total from chats where server_id = ${serverId} and id = ${dm.id}
    `;
    expect(dmRow.total).toBe(1);

    // The membership row is revoked, never deleted, so those records resolve.
    const [membership] = await harness.sql`
        select revoked_at is not null as revoked from server_memberships
        where server_id = ${serverId} and user_id = ${leaverUserId}
    `;
    expect(membership.revoked).toBe(true);

    // Personal work is gone.
    const [personal] = await harness.sql`
        select
            (select count(*)::int from channel_participants
                where server_id = ${serverId} and user_id = ${leaverUserId}) as participants,
            (select count(*)::int from chat_reads
                where server_id = ${serverId} and reader_user_id = ${leaverUserId}) as reads
    `;
    expect(personal).toMatchObject({ participants: 0, reads: 0 });
});

test('removal requires the exact Server address', async () => {
    const kept = await signIn('user_removal_kept', ['removal-kept@grotto.test']);
    await join(kept, 'removal-kept@grotto.test');
    const keptUserId = await readUserId('user_removal_kept');

    await expect(
        owner.trpc.member.remove.mutate({
            confirmation: 'not-the-slug',
            serverId,
            userId: keptUserId,
        })
    ).rejects.toThrow(/address/i);

    await expect(kept.trpc.server.bySlug.query({ slug })).resolves.toMatchObject({
        role: 'member',
    });
});

test('an Admin removes Members only, and a Member removes nobody', async () => {
    const admin = await signIn('user_removal_admin', ['removal-admin@grotto.test']);
    const target = await signIn('user_removal_target', ['removal-target@grotto.test']);
    await join(admin, 'removal-admin@grotto.test');
    await join(target, 'removal-target@grotto.test');
    const adminUserId = await readUserId('user_removal_admin');
    const targetUserId = await readUserId('user_removal_target');

    await owner.trpc.member.changeRole.mutate({
        confirmation: slug,
        role: 'admin',
        serverId,
        userId: adminUserId,
    });

    await expect(
        target.trpc.member.remove.mutate({ confirmation: slug, serverId, userId: adminUserId })
    ).rejects.toThrow(/Owner or Admin/i);
    await expect(
        admin.trpc.member.remove.mutate({
            confirmation: slug,
            serverId,
            userId: await readUserId('user_removal_owner'),
        })
    ).rejects.toThrow(/Owner/i);

    await expect(
        admin.trpc.member.remove.mutate({ confirmation: slug, serverId, userId: targetUserId })
    ).resolves.toMatchObject({ serverId, userId: targetUserId });
});

test('removing yourself directs you to leaving instead', async () => {
    const selfRemover = await signIn('user_removal_self', ['removal-self@grotto.test']);
    await join(selfRemover, 'removal-self@grotto.test');
    const selfUserId = await readUserId('user_removal_self');

    await expect(
        selfRemover.trpc.member.remove.mutate({
            confirmation: slug,
            serverId,
            userId: selfUserId,
        })
    ).rejects.toThrow(/leave/i);

    await expect(
        selfRemover.trpc.member.leave.mutate({ confirmation: 'wrong', serverId })
    ).rejects.toThrow(/address/i);

    await expect(
        selfRemover.trpc.member.leave.mutate({ confirmation: slug, serverId })
    ).resolves.toMatchObject({ serverId, userId: selfUserId });
    await expect(selfRemover.trpc.server.bySlug.query({ slug })).rejects.toThrow(/not a member/i);
});

test('the last Owner can neither leave nor be removed', async () => {
    await expect(owner.trpc.member.leave.mutate({ confirmation: slug, serverId })).rejects.toThrow(
        /last Owner/i
    );

    const ownerUserId = await readUserId('user_removal_owner');
    const second = await signIn('user_removal_second_owner', ['removal-second@grotto.test']);
    await join(second, 'removal-second@grotto.test');
    const secondUserId = await readUserId('user_removal_second_owner');
    await owner.trpc.member.changeRole.mutate({
        confirmation: slug,
        role: 'owner',
        serverId,
        userId: secondUserId,
    });

    // With two Owners the invariant lifts for either of them.
    await expect(
        second.trpc.member.remove.mutate({ confirmation: slug, serverId, userId: ownerUserId })
    ).resolves.toMatchObject({ userId: ownerUserId });
    await expect(second.trpc.member.leave.mutate({ confirmation: slug, serverId })).rejects.toThrow(
        /last Owner/i
    );
});

async function join(client: GrottoClient, email: string) {
    const { token } = await owner.trpc.invitation.create.mutate({ email, serverId });
    await client.trpc.invitation.accept.mutate({ token });
}

async function readUserId(clerkUserId: string) {
    const [row] = await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `;

    return row.id as string;
}

async function signIn(clerkUserId: string, verifiedEmails: string[]) {
    harness.clerkUsers.setVerifiedEmails(clerkUserId, verifiedEmails);

    const token = await harness.clerk.mintSessionToken(clerkUserId);

    return createGrottoClient(harness, token);
}
