import { afterAll, beforeAll, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { createGrottoServerApplication } from '../src/grotto-server-application.ts';
import { startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let cluster: PostgresCluster;
let observer: SQL;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    // One connection, so the observer's own pool cannot be mistaken for the
    // application's backends.
    observer = new SQL({ max: 1, url: cluster.databaseUrl });
});

afterAll(async () => {
    await observer.close();
    cluster.stop();
});

test('closes PostgreSQL when application construction fails', async () => {
    await expect(
        createGrottoServerApplication({
            appOrigin: 'https://app.grotto.test',
            clerkIssuerUrl: 'not-a-clerk-instance',
            databaseUrl: cluster.databaseUrl,
        })
    ).rejects.toThrow();

    await expect(waitForIdleBackends()).resolves.toBe(0);
});

test('closes PostgreSQL when a started application shuts down', async () => {
    const clerk = await startClerkTestIssuer();
    const application = await createGrottoServerApplication({
        appOrigin: 'https://app.grotto.test',
        clerkIssuerUrl: clerk.url,
        databaseUrl: cluster.databaseUrl,
    });

    expect(await countOtherBackends()).toBeGreaterThan(0);

    await application.close();
    await clerk.close();

    await expect(waitForIdleBackends()).resolves.toBe(0);
});

test('closes PostgreSQL when the Server cannot bind its port', async () => {
    const clerk = await startClerkTestIssuer();
    const occupied = Bun.listen({
        hostname: '0.0.0.0',
        port: 0,
        socket: { data: () => undefined },
    });
    const application = await createGrottoServerApplication({
        appOrigin: 'https://app.grotto.test',
        clerkIssuerUrl: clerk.url,
        databaseUrl: cluster.databaseUrl,
    });

    try {
        await expect(application.listen(occupied.port)).rejects.toThrow(/in use/i);

        await expect(waitForIdleBackends()).resolves.toBe(0);
    } finally {
        occupied.stop(true);
        await clerk.close();
    }
});

const idleTimeoutMs = 5000;
const idlePollMs = 50;

async function waitForIdleBackends() {
    const deadline = Date.now() + idleTimeoutMs;
    let backends = await countOtherBackends();

    while (backends > 0 && Date.now() < deadline) {
        await Bun.sleep(idlePollMs);
        backends = await countOtherBackends();
    }

    return backends;
}

async function countOtherBackends() {
    const rows = (await observer`
        select count(*)::int as total from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid()
    `) as { total: number }[];

    return rows[0].total;
}
