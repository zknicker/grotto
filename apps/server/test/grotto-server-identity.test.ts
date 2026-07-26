import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
const openClients: GrottoClient[] = [];

beforeAll(async () => {
    harness = await startGrottoServerHarness();
});

afterAll(async () => {
    for (const client of openClients) {
        client.close();
    }

    await harness.close();
});

test('rejects Server reads without a Clerk session', async () => {
    const client = createGrottoClient(harness);

    await expect(client.trpc.server.list.query()).rejects.toThrow(/sign in/i);
    client.close();
});

test('rejects a Clerk session minted for another authorized party', async () => {
    const foreignOrigin = await signIn('user_clerk_foreign_origin', {
        azp: 'https://someone-elses-app.example',
    });
    const noAuthorizedParty = await signIn('user_clerk_no_azp', { azp: undefined });

    await expect(foreignOrigin.trpc.server.list.query()).rejects.toThrow(/sign in/i);
    await expect(noAuthorizedParty.trpc.server.list.query()).rejects.toThrow(/sign in/i);
});

test('lists no Servers, and mints no User, for a human who has none', async () => {
    const client = await signIn('user_clerk_fresh');

    await expect(client.trpc.server.list.query()).resolves.toEqual([]);
    await expect(countUsers('user_clerk_fresh')).resolves.toBe(0);
});

test('leaves no User behind when Server creation rolls back', async () => {
    const existing = await signIn('user_clerk_first');
    await existing.trpc.server.create.mutate({ displayName: 'Taken', slug: 'taken' });

    const newcomer = await signIn('user_clerk_rollback');

    await expect(
        newcomer.trpc.server.create.mutate({ displayName: 'Also taken', slug: 'taken' })
    ).rejects.toThrow(/already taken/i);
    await expect(countUsers('user_clerk_rollback')).resolves.toBe(0);

    // The same human can still create a Server afterwards.
    const created = await newcomer.trpc.server.create.mutate({
        displayName: 'Fresh',
        slug: 'fresh',
    });

    expect(created.role).toBe('owner');
    await expect(countUsers('user_clerk_rollback')).resolves.toBe(1);
});

test('maps every Clerk session of one human to the same Grotto User', async () => {
    const first = await signIn('user_clerk_stable', { org_id: 'org_a', org_role: 'org:admin' });
    await first.trpc.server.create.mutate({ displayName: 'Stable', slug: 'stable' });

    const later = await signIn('user_clerk_stable', { org_id: 'org_b' });

    await expect(later.trpc.server.list.query()).resolves.toMatchObject([{ slug: 'stable' }]);
    await expect(countUsers('user_clerk_stable')).resolves.toBe(1);
});

async function signIn(clerkUserId: string, claims?: Record<string, unknown>) {
    const token = await harness.clerk.mintSessionToken(clerkUserId, claims);
    const client = createGrottoClient(harness, token);

    openClients.push(client);
    return client;
}

async function countUsers(clerkUserId: string) {
    const rows = (await harness.sql`
        select count(*)::int as total from users where clerk_user_id = ${clerkUserId}
    `) as { total: number }[];

    return rows[0].total;
}
