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

test('creates a Server with an opaque id, its first Owner, and #all', async () => {
    const client = await signIn('user_clerk_owner');

    const created = await client.trpc.server.create.mutate({
        displayName: 'Grotto HQ',
        slug: 'grotto-hq',
    });

    expect(created.slug).toBe('grotto-hq');
    expect(created.displayName).toBe('Grotto HQ');
    expect(created.role).toBe('owner');
    expect(created.id).not.toBe(created.slug);
    expect(created.id).toMatch(/^srv_[A-Za-z0-9_-]{16,}$/);
    expect(created.channels).toEqual([{ id: expect.any(String), name: 'all' }]);

    await expect(client.trpc.server.list.query()).resolves.toEqual([
        { displayName: 'Grotto HQ', id: created.id, role: 'owner', slug: 'grotto-hq' },
    ]);
});

test('maps every Clerk session of one human to the same Grotto User', async () => {
    const other = await signIn('user_clerk_second', {
        org_id: 'org_ignored',
        org_role: 'org:admin',
    });

    await other.trpc.server.create.mutate({ displayName: 'Second', slug: 'second' });

    const laterSession = await signIn('user_clerk_second', { org_id: 'org_changed' });
    const servers = await laterSession.trpc.server.list.query();

    expect(servers.map((server) => server.slug)).toEqual(['second']);
});

test('rejects a slug that is already taken', async () => {
    const client = await signIn('user_clerk_taken');

    await expect(
        client.trpc.server.create.mutate({ displayName: 'Duplicate', slug: 'grotto-hq' })
    ).rejects.toThrow(/already taken/i);
    await expect(client.trpc.server.list.query()).resolves.toEqual([]);
});

test('rejects a slug that is not a valid Server address', async () => {
    const client = await signIn('user_clerk_invalid');

    await expect(
        client.trpc.server.create.mutate({ displayName: 'Bad', slug: 'Not A Slug' })
    ).rejects.toThrow();
});

test('creates no Computer or Agent alongside the Server', async () => {
    const client = await signIn('user_clerk_bare');
    const created = await client.trpc.server.create.mutate({
        displayName: 'Bare',
        slug: 'bare',
    });

    expect(created.channels).toHaveLength(1);
    await expect(readTableNames()).resolves.toEqual([
        'agents',
        'attachments',
        'channel_agent_participants',
        'channel_participants',
        'chat_events',
        'chat_messages',
        'chat_reads',
        'chats',
        'message_task_labels',
        'message_tasks',
        'reminder_agent_attention',
        'reminder_commands',
        'reminder_fires',
        'reminders',
        'server_invitations',
        'server_memberships',
        'servers',
        'task_labels',
        'thread_follows',
        'users',
    ]);
});

test('PostgreSQL refuses a Server role outside owner, admin, and member', async () => {
    const client = await signIn('user_clerk_roles');
    const created = await client.trpc.server.create.mutate({
        displayName: 'Roles',
        slug: 'roles',
    });
    const writeIntruderRole = async () => {
        await harness.sql`
            update server_memberships set role = 'intruder' where server_id = ${created.id}
        `;
    };

    await expect(writeIntruderRole()).rejects.toThrow(/server_memberships_role/i);
    await expect(client.trpc.server.bySlug.query({ slug: 'roles' })).resolves.toMatchObject({
        role: 'owner',
    });
});

async function signIn(clerkUserId: string, claims?: Record<string, unknown>) {
    const token = await harness.clerk.mintSessionToken(clerkUserId, claims);
    const client = createGrottoClient(harness, token);

    openClients.push(client);
    return client;
}

async function readTableNames() {
    const rows = (await harness.sql`
        select table_name from information_schema.tables
        where table_schema = 'public'
        order by table_name
    `) as { table_name: string }[];

    return rows.map((row) => row.table_name);
}
