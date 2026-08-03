import { afterAll, beforeAll, expect, test } from 'bun:test';
import { appProtocolHeaders, appProtocolVersion } from '@tavern/api';
import { getCurrentSessionToken } from '../src/identity/session-token-store.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

/**
 * The hosted Server exposes the Grotto Server contract plus its localhost-only
 * dev sign-in bootstrap. Legacy local-owner procedures remain unreachable here.
 */
let harness: GrottoServerHarness;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
});

afterAll(async () => {
    await harness.close();
});

const legacyProcedures = [
    'identity.me',
    'identity.pushSessionToken',
    'identity.removeMember',
    'agentRuntime.connect',
    'skill.list',
    'model.list',
];

test('exposes no legacy local-owner procedure', async () => {
    for (const path of legacyProcedures) {
        const response = await fetch(new URL(`/trpc/${path}`, harness.url), {
            body: '{}',
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });

        expect({ path, status: response.status }).toEqual({ path, status: 404 });
        expect(await response.text()).toContain('No procedure found');
    }
});

test('exposes the dev sign-in bootstrap only on localhost', async () => {
    const response = await fetch(new URL('/trpc/dev.createClerkSignInToken', harness.url), {
        body: '{}',
        headers: {
            [appProtocolHeaders.productVersion]: 'test',
            [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
            'content-type': 'application/json',
            host: 'grotto.example',
        },
        method: 'POST',
    });
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(body).toContain('available only from localhost');
    expect(body).not.toContain('No procedure found');
});

test('never publishes a session token to the shared Runtime transport', async () => {
    const token = await harness.clerk.mintSessionToken('user_clerk_surface');
    const response = await fetch(new URL('/trpc/identity.pushSessionToken', harness.url), {
        body: '{}',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        method: 'POST',
    });

    expect(response.status).toBe(404);
    expect(getCurrentSessionToken()).toBeNull();
});

test('requires a Clerk session for the Server contract it does expose', async () => {
    const response = await fetch(new URL('/trpc/server.list', harness.url), {
        headers: {
            [appProtocolHeaders.productVersion]: 'test',
            [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
        },
    });

    expect(response.status).toBe(401);
});
