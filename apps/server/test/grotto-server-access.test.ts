import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
const openClients: GrottoClient[] = [];

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_clerk_access_owner');
    await owner.trpc.server.create.mutate({ displayName: 'Grotto HQ', slug: 'grotto-hq' });
    await owner.trpc.server.create.mutate({ displayName: 'Side Quest', slug: 'side-quest' });
});

afterAll(async () => {
    for (const client of openClients) {
        client.close();
    }

    await harness.close();
});

test('opens a Server by slug with #all', async () => {
    const server = await owner.trpc.server.bySlug.query({ slug: 'grotto-hq' });

    expect(server.slug).toBe('grotto-hq');
    expect(server.displayName).toBe('Grotto HQ');
    expect(server.role).toBe('owner');
    expect(server.channels.map((channel) => channel.name)).toEqual(['all']);
});

test('switches between the Servers a human can access', async () => {
    const servers = await owner.trpc.server.list.query();

    expect(servers.map((server) => server.slug)).toEqual(['grotto-hq', 'side-quest']);

    const switched = await owner.trpc.server.bySlug.query({ slug: 'side-quest' });

    expect(switched.displayName).toBe('Side Quest');
});

test('edits the display name while the slug stays the address', async () => {
    const server = await owner.trpc.server.bySlug.query({ slug: 'side-quest' });
    const renamed = await owner.trpc.server.rename.mutate({
        displayName: 'Side Quests',
        serverId: server.id,
    });

    expect(renamed).toMatchObject({
        displayName: 'Side Quests',
        id: server.id,
        slug: 'side-quest',
    });
    await expect(owner.trpc.server.bySlug.query({ slug: 'side-quest' })).resolves.toMatchObject({
        displayName: 'Side Quests',
    });
});

test('exposes no way to change an immutable Server slug', async () => {
    const server = await owner.trpc.server.bySlug.query({ slug: 'grotto-hq' });

    await expect(
        owner.trpc.server.rename.mutate({
            displayName: 'Grotto HQ',
            serverId: server.id,
            slug: 'renamed-hq',
        } as never)
    ).rejects.toThrow(/unrecognized key|slug/i);
    await expect(owner.trpc.server.bySlug.query({ slug: 'renamed-hq' })).rejects.toThrow();
    await expect(owner.trpc.server.bySlug.query({ slug: 'grotto-hq' })).resolves.toMatchObject({
        id: server.id,
    });
});

test('denies a human without membership every Server boundary', async () => {
    const server = await owner.trpc.server.bySlug.query({ slug: 'grotto-hq' });
    const outsider = await signIn('user_clerk_outsider');

    await expect(outsider.trpc.server.list.query()).resolves.toEqual([]);
    await expect(outsider.trpc.server.bySlug.query({ slug: 'grotto-hq' })).rejects.toThrow(
        /not a member/i
    );
    await expect(
        outsider.trpc.server.rename.mutate({ displayName: 'Mine now', serverId: server.id })
    ).rejects.toThrow(/not a member/i);
    await expect(subscribeToServer(outsider, server.id).started).rejects.toThrow(/not a member/i);

    await expect(owner.trpc.server.bySlug.query({ slug: 'grotto-hq' })).resolves.toMatchObject({
        displayName: 'Grotto HQ',
    });
});

test('delivers Server updates to a member subscription', async () => {
    const server = await owner.trpc.server.bySlug.query({ slug: 'grotto-hq' });
    const subscription = subscribeToServer(owner, server.id);

    await subscription.started;
    await owner.trpc.server.rename.mutate({ displayName: 'Grotto HQ 2', serverId: server.id });
    await expect(subscription.nextEvent).resolves.toMatchObject({ serverId: server.id });

    await owner.trpc.server.rename.mutate({ displayName: 'Grotto HQ', serverId: server.id });
});

const subscriptionTimeoutMs = 5000;

function subscribeToServer(client: GrottoClient, serverId: string) {
    const started = Promise.withResolvers<void>();
    const nextEvent = Promise.withResolvers<{ serverId: string }>();
    const timeout = setTimeout(() => {
        nextEvent.reject(new Error('Timed out waiting for a Server update.'));
    }, subscriptionTimeoutMs);
    const subscription = client.trpc.server.onUpdate.subscribe(
        { serverId },
        {
            onData: (event) => {
                clearTimeout(timeout);
                subscription.unsubscribe();
                nextEvent.resolve(event as { serverId: string });
            },
            onError: (error) => {
                clearTimeout(timeout);
                started.reject(error);
                nextEvent.reject(error);
            },
            onStarted: () => started.resolve(),
        }
    );

    // Both promises settle from the same stream; keep the unread one silent.
    started.promise.catch(() => undefined);
    nextEvent.promise.catch(() => undefined);

    return { nextEvent: nextEvent.promise, started: started.promise };
}

async function signIn(clerkUserId: string) {
    const token = await harness.clerk.mintSessionToken(clerkUserId);
    const client = createGrottoClient(harness, token);

    openClients.push(client);
    return client;
}
