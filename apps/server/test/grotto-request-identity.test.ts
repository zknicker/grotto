import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoContextFactory } from '../src/grotto-api/context.ts';
import { getCurrentSessionToken } from '../src/identity/session-token-store.ts';
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

test('Server requests never write the shared Runtime session token', () => {
    const createContext = createGrottoContextFactory({
        clerkSessions: unavailable('Clerk session verification'),
        grottoDb: unavailable('the Grotto PostgreSQL database'),
    });

    const context = createContext({
        req: { headers: { authorization: 'Bearer clerk-session-from-one-human' } },
    });

    expect(context.clerkSessionToken).toBe('clerk-session-from-one-human');
    expect(getCurrentSessionToken()).toBeNull();
});

test('concurrent humans each see only their own Servers', async () => {
    const [ada, grace] = await Promise.all([signIn('user_clerk_ada'), signIn('user_clerk_grace')]);

    await Promise.all([
        ada.trpc.server.create.mutate({ displayName: 'Ada HQ', slug: 'ada-hq' }),
        grace.trpc.server.create.mutate({ displayName: 'Grace HQ', slug: 'grace-hq' }),
    ]);

    const rounds = Array.from({ length: 8 }, (_, index) =>
        index % 2 === 0
            ? ada.trpc.server.list.query().then((servers) => ['ada', servers] as const)
            : grace.trpc.server.list.query().then((servers) => ['grace', servers] as const)
    );

    for (const [who, servers] of await Promise.all(rounds)) {
        expect(servers.map((server) => server.slug)).toEqual([
            who === 'ada' ? 'ada-hq' : 'grace-hq',
        ]);
    }

    expect(getCurrentSessionToken()).toBeNull();
});

/** Building a context must read no dependency; touching one is the failure. */
function unavailable<T extends object>(subject: string): T {
    return new Proxy({} as T, {
        get() {
            throw new Error(`This test must not use ${subject}.`);
        },
    });
}

async function signIn(clerkUserId: string) {
    const token = await harness.clerk.mintSessionToken(clerkUserId);
    const client = createGrottoClient(harness, token);

    openClients.push(client);
    return client;
}
