import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTestRuntime } from '@grotto/effect';
import { TestClock } from 'effect';
import Fastify from 'fastify';
import { registerGrottoHealth } from '../src/grotto-health.ts';
import {
    createGrottoServerApplication,
    type GrottoServerApplication,
} from '../src/grotto-server-application.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { type ClerkTestIssuer, startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

const appOrigin = 'https://grotto.sh';
let application: GrottoServerApplication;
let clerk: ClerkTestIssuer;
let cluster: PostgresCluster;
let healthUrl: string;
let attachmentRoot: string;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    clerk = await startClerkTestIssuer(appOrigin);
    attachmentRoot = await mkdtemp(join(tmpdir(), 'grotto-health-attachments-'));
    application = await createGrottoServerApplication({
        appOrigin,
        attachmentRoot,
        clerkIssuerUrl: clerk.url,
        databaseUrl: cluster.databaseUrl,
    });
    await application.listen(0);
    const address = application.app.server.address() as AddressInfo;
    healthUrl = `http://127.0.0.1:${address.port}/healthz`;
});

afterAll(async () => {
    await application.close();
    await clerk.close();
    await cluster.stop();
    await rm(attachmentRoot, { force: true, recursive: true });
});

test('reports PostgreSQL failure without exposing connection details', async () => {
    const healthy = await fetch(healthUrl);
    expect(healthy.status).toBe(200);
    expect(await healthy.json()).toMatchObject({
        reminders: { status: 'healthy' },
        status: 'ok',
    });

    await cluster.stop();

    const unavailable = await fetch(healthUrl);
    const body = await unavailable.text();
    expect(unavailable.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
        code: 'postgres_unavailable',
        status: 'unhealthy',
    });
    expect(body).not.toContain('postgres://');
});

test('classifies a hung PostgreSQL probe without hanging the health route', async () => {
    const app = Fastify();
    const runtime = makeTestRuntime();
    const probeStarted = Promise.withResolvers<void>();
    let aborted = false;
    registerGrottoHealth(
        app,
        runtime,
        (signal) => {
            probeStarted.resolve();
            signal?.addEventListener('abort', () => {
                aborted = true;
            });
            return new Promise(() => undefined);
        },
        10
    );

    const response = app.inject('/healthz');
    try {
        await probeStarted.promise;
        await runtime.runPromise(TestClock.adjust('10 millis'));
        const completed = await response;
        expect(completed.statusCode).toBe(503);
        expect(completed.json()).toEqual({
            code: 'postgres_unavailable',
            status: 'unhealthy',
        });
        expect(aborted).toBe(true);
    } finally {
        await app.close();
        await runtime.dispose();
    }
});
