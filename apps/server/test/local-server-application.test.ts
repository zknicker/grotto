import { afterEach, expect, test } from 'bun:test';
import { type ServerTestHarness, startServerTestHarness } from './server-harness.ts';

/**
 * Regression for the packaged desktop sidecar: it launches with a SQLite
 * `--database-path` and no PostgreSQL anywhere, so the local application must
 * start and serve its legacy router without a Grotto database.
 */
const appOrigin = 'https://app.grotto.test';
let harness: ServerTestHarness | null = null;

afterEach(async () => {
    await harness?.close();
    harness = null;
});

test('starts and serves the legacy router with no PostgreSQL available', async () => {
    harness = await startServerTestHarness({ appOrigin });

    const health = await fetch(new URL('/healthz', harness.url));
    const legacy = await fetch(new URL('/trpc/identity.me', harness.url));

    expect(health.status).toBe(200);
    expect(legacy.status).toBe(200);
    expect(await legacy.json()).toEqual({ result: { data: null } });
});
