import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

/**
 * A WebSocket carries the Clerk session it was opened with. The Server must
 * still judge every authenticated operation against a current token, so a
 * socket whose session has expired cannot start a new subscription.
 */
let harness: GrottoServerHarness;
let serverId: string;
const openClients: GrottoClient[] = [];

beforeAll(async () => {
    harness = await startGrottoServerHarness();

    const owner = await connect(await harness.clerk.mintSessionToken('user_clerk_freshness'));
    const created = await owner.trpc.server.create.mutate({
        displayName: 'Freshness',
        slug: 'freshness',
    });

    serverId = created.id;
});

afterAll(async () => {
    for (const client of openClients) {
        client.close();
    }

    await harness.close();
});

test('refuses a subscription on a socket whose Clerk session expired', async () => {
    const stale = await connect(
        await harness.clerk.mintExpiredSessionToken('user_clerk_freshness')
    );

    await expect(subscribeStarted(stale)).rejects.toThrow(/sign in/i);
});

test('accepts the same subscription once the socket carries a current session', async () => {
    const refreshed = await connect(await harness.clerk.mintSessionToken('user_clerk_freshness'));

    await expect(subscribeStarted(refreshed)).resolves.toBeUndefined();
});

function subscribeStarted(client: GrottoClient) {
    const started = Promise.withResolvers<void>();
    const subscription = client.trpc.server.onUpdate.subscribe(
        { serverId },
        {
            onError: (error) => started.reject(error),
            onStarted: () => {
                subscription.unsubscribe();
                started.resolve();
            },
        }
    );

    return started.promise;
}

async function connect(clerkSessionToken: string) {
    const client = createGrottoClient(harness, clerkSessionToken);

    openClients.push(client);
    return client;
}
