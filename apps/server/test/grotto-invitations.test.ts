import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

/**
 * Invitations are Server-owned, email-bound, single-use, and expire after seven
 * days. The raw token leaves the Server exactly once, in the response to the
 * Owner or Admin who issued it.
 */
let harness: GrottoServerHarness;
let owner: GrottoClient;
let admin: GrottoClient;
let plainMember: GrottoClient;
let outsider: GrottoClient;
let serverId: string;
let outsiderServerId: string;

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_invite_owner');
    admin = await signIn('user_invite_admin');
    plainMember = await signIn('user_invite_member');
    outsider = await signIn('user_invite_outsider');

    const created = await owner.trpc.server.create.mutate({
        displayName: 'Invite HQ',
        slug: 'invite-hq',
    });
    serverId = created.id;

    const outsiderServer = await outsider.trpc.server.create.mutate({
        displayName: 'Outsider Root',
        slug: 'invite-outsider-root',
    });
    outsiderServerId = outsiderServer.id;

    // Slice fixture: acceptance does not exist yet, so the Admin and Member
    // standings are seeded directly. Later slices create them through the
    // product flow.
    await admin.trpc.server.create.mutate({ displayName: 'Admin Root', slug: 'invite-admin-root' });
    await plainMember.trpc.server.create.mutate({
        displayName: 'Member Root',
        slug: 'invite-member-root',
    });

    const adminUserId = await readUserId('user_invite_admin');
    const memberUserId = await readUserId('user_invite_member');

    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values
            ('mem_invite_admin', ${serverId}, ${adminUserId}, 'admin'),
            ('mem_invite_member', ${serverId}, ${memberUserId}, 'member')
    `;
});

afterAll(async () => {
    for (const client of [owner, admin, plainMember, outsider]) {
        client.close();
    }

    await harness.close();
});

test('an Owner issues an invitation whose raw token is disclosed exactly once', async () => {
    const created = await owner.trpc.invitation.create.mutate({
        email: 'first@grotto.test',
        serverId,
    });

    expect(created.token).toMatch(/^[\w-]{20,}$/u);
    expect(created.invitation).toMatchObject({
        email: 'first@grotto.test',
        status: 'pending',
    });

    const expiresAt = Date.parse(created.invitation.expiresAt);
    const createdAt = Date.parse(created.invitation.createdAt);
    expect(expiresAt - createdAt).toBe(sevenDaysMs);

    const listed = await owner.trpc.invitation.list.query({ serverId });
    const found = listed.find((invitation) => invitation.id === created.invitation.id);

    expect(found).toBeDefined();
    expect(Object.keys(found ?? {}).sort()).toEqual([
        'createdAt',
        'email',
        'expiresAt',
        'id',
        'invitedByUserId',
        'status',
    ]);
});

test('an invitation email is stored and returned normalized', async () => {
    const created = await owner.trpc.invitation.create.mutate({
        email: '  MiXeD.Case@Grotto.TEST  ',
        serverId,
    });

    expect(created.invitation.email).toBe('mixed.case@grotto.test');
});

test('an Admin may invite; a Member and a non-member may not', async () => {
    const created = await admin.trpc.invitation.create.mutate({
        email: 'admin-invited@grotto.test',
        serverId,
    });
    expect(created.invitation.status).toBe('pending');

    await expect(
        plainMember.trpc.invitation.create.mutate({ email: 'nope@grotto.test', serverId })
    ).rejects.toThrow(/Owner or Admin/i);
    await expect(plainMember.trpc.invitation.list.query({ serverId })).rejects.toThrow(
        /Owner or Admin/i
    );
    await expect(
        outsider.trpc.invitation.create.mutate({ email: 'nope@grotto.test', serverId })
    ).rejects.toThrow(/not a member/i);
    await expect(outsider.trpc.invitation.list.query({ serverId })).rejects.toThrow(
        /not a member/i
    );
});

test('a Server keeps at most one live invitation per email', async () => {
    await owner.trpc.invitation.create.mutate({ email: 'once@grotto.test', serverId });

    await expect(
        owner.trpc.invitation.create.mutate({ email: 'once@grotto.test', serverId })
    ).rejects.toThrow(/already/i);
    await expect(
        admin.trpc.invitation.create.mutate({ email: 'ONCE@grotto.test', serverId })
    ).rejects.toThrow(/already/i);
});

test('revoking an invitation frees the email for a fresh invitation', async () => {
    const created = await owner.trpc.invitation.create.mutate({
        email: 'revocable@grotto.test',
        serverId,
    });

    const revoked = await admin.trpc.invitation.revoke.mutate({
        invitationId: created.invitation.id,
        serverId,
    });
    expect(revoked.status).toBe('revoked');

    const reissued = await owner.trpc.invitation.create.mutate({
        email: 'revocable@grotto.test',
        serverId,
    });
    expect(reissued.invitation.status).toBe('pending');
    expect(reissued.token).not.toBe(created.token);

    await expect(
        plainMember.trpc.invitation.revoke.mutate({
            invitationId: reissued.invitation.id,
            serverId,
        })
    ).rejects.toThrow(/Owner or Admin/i);
});

test('an invitation past its seventh day reads as expired', async () => {
    const created = await owner.trpc.invitation.create.mutate({
        email: 'stale@grotto.test',
        serverId,
    });

    await harness.sql`
        update server_invitations
        set expires_at = now() - interval '1 minute'
        where id = ${created.invitation.id}
    `;

    const listed = await owner.trpc.invitation.list.query({ serverId });
    const found = listed.find((invitation) => invitation.id === created.invitation.id);

    expect(found?.status).toBe('expired');

    // A lapsed invitation must not hold the address hostage.
    const reissued = await owner.trpc.invitation.create.mutate({
        email: 'stale@grotto.test',
        serverId,
    });
    expect(reissued.invitation.status).toBe('pending');

    const afterReissue = await owner.trpc.invitation.list.query({ serverId });
    const superseded = afterReissue.find((invitation) => invitation.id === created.invitation.id);
    expect(superseded?.status).toBe('revoked');
});

test('invitations fail closed across Servers', async () => {
    const created = await owner.trpc.invitation.create.mutate({
        email: 'cross@grotto.test',
        serverId,
    });

    await expect(
        owner.trpc.invitation.create.mutate({
            email: 'cross@grotto.test',
            serverId: outsiderServerId,
        })
    ).rejects.toThrow(/not a member/i);
    await expect(owner.trpc.invitation.list.query({ serverId: outsiderServerId })).rejects.toThrow(
        /not a member/i
    );
    await expect(
        outsider.trpc.invitation.revoke.mutate({
            invitationId: created.invitation.id,
            serverId: outsiderServerId,
        })
    ).rejects.toThrow();

    const stillPending = await owner.trpc.invitation.list.query({ serverId });
    expect(stillPending.find((invitation) => invitation.id === created.invitation.id)?.status).toBe(
        'pending'
    );
});

test('issuing and revoking an invitation notifies an open Server subscription', async () => {
    const seen: { serverId: string }[] = [];
    const started = Promise.withResolvers<void>();
    const subscription = owner.trpc.server.onUpdate.subscribe(
        { serverId },
        {
            onData: (event) => seen.push(event as { serverId: string }),
            onError: () => started.reject(new Error('The Server subscription failed.')),
            onStarted: () => started.resolve(),
        }
    );

    await started.promise;

    const created = await owner.trpc.invitation.create.mutate({
        email: 'notified@grotto.test',
        serverId,
    });
    await Bun.sleep(150);
    expect(seen.length).toBeGreaterThan(0);

    const afterCreate = seen.length;
    await owner.trpc.invitation.revoke.mutate({
        invitationId: created.invitation.id,
        serverId,
    });
    await Bun.sleep(150);
    expect(seen.length).toBeGreaterThan(afterCreate);

    subscription.unsubscribe();
});

async function readUserId(clerkUserId: string) {
    const [row] = await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `;

    return row.id as string;
}

async function signIn(clerkUserId: string) {
    const token = await harness.clerk.mintSessionToken(clerkUserId);

    return createGrottoClient(harness, token);
}
