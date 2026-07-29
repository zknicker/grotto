import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SQL } from 'bun';
import { createGrottoServerApplication } from '../src/grotto-server-application.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

const appOrigin = 'https://app.grotto.test';
let cluster: PostgresCluster;
let observer: SQL;
let attachmentRoot: string;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    attachmentRoot = await mkdtemp(join(tmpdir(), 'grotto-lifecycle-attachments-'));
    // One connection, so the observer's own pool cannot be mistaken for the
    // application's backends.
    observer = new SQL({ max: 1, url: cluster.databaseUrl });
});

afterAll(async () => {
    await observer.close();
    await cluster.stop();
    await rm(attachmentRoot, { force: true, recursive: true });
});

test('closes PostgreSQL when application construction fails', async () => {
    await expect(
        createGrottoServerApplication({
            appOrigin,
            attachmentRoot,
            clerkIssuerUrl: 'not-a-clerk-instance',
            databaseUrl: cluster.databaseUrl,
        })
    ).rejects.toThrow();

    await expect(waitForIdleBackends()).resolves.toBe(0);
});

test('closes PostgreSQL when a started application shuts down', async () => {
    const clerk = await startClerkTestIssuer(appOrigin);
    const application = await createGrottoServerApplication({
        appOrigin,
        attachmentRoot,
        clerkIssuerUrl: clerk.url,
        databaseUrl: cluster.databaseUrl,
    });

    expect(await countOtherBackends()).toBeGreaterThan(0);

    await application.close();
    await clerk.close();

    await expect(waitForIdleBackends()).resolves.toBe(0);
});

test('closes PostgreSQL when the Server cannot bind its port', async () => {
    const clerk = await startClerkTestIssuer(appOrigin);
    const occupied = Bun.listen({
        hostname: '127.0.0.1',
        port: 0,
        socket: { data: () => undefined },
    });
    const application = await createGrottoServerApplication({
        appOrigin,
        attachmentRoot,
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
