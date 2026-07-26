import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    createGrottoServerApplication,
    type GrottoServerApplication,
} from '../src/grotto-server-application.ts';
import { type ClerkTestIssuer, startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

const appOrigin = 'https://grotto.sh';
let application: GrottoServerApplication;
let clerk: ClerkTestIssuer;
let cluster: PostgresCluster;
let staticAppRoot: string;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    clerk = await startClerkTestIssuer(appOrigin);
    staticAppRoot = mkdtempSync(join(tmpdir(), 'grotto-static-app-'));
    writeFileSync(
        join(staticAppRoot, 'index.html'),
        '<!doctype html><title>Grotto</title><script src="/assets/app.js"></script>'
    );
    mkdirSync(join(staticAppRoot, 'assets'));
    writeFileSync(join(staticAppRoot, 'assets', 'app.js'), 'window.__grotto = true;');

    application = await createGrottoServerApplication({
        appOrigin,
        clerkIssuerUrl: clerk.url,
        databaseUrl: cluster.databaseUrl,
        staticAppRoot,
    });
    await application.listen(0);
});

test('serves the hosted App assets from the same origin', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/assets/app.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('window.__grotto = true;');
});

afterAll(async () => {
    await application.close();
    await clerk.close();
    await cluster.stop();
    rmSync(staticAppRoot, { force: true, recursive: true });
});

test('serves the hosted App history route from a loopback-only Server', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/s/grotto-hq`, {
        headers: { accept: 'text/html' },
    });

    expect(address.address).toBe('127.0.0.1');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Grotto</title>');
});
