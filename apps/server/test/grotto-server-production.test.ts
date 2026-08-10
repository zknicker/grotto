import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
let staticAppRoot: string;
let attachmentRoot: string;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    clerk = await startClerkTestIssuer(appOrigin);
    attachmentRoot = mkdtempSync(join(tmpdir(), 'grotto-production-attachments-'));
    staticAppRoot = mkdtempSync(join(tmpdir(), 'grotto-static-app-'));
    writeFileSync(
        join(staticAppRoot, 'index.html'),
        '<!doctype html><title>Grotto</title><script src="/assets/app.js"></script>'
    );
    writeFileSync(
        join(staticAppRoot, 'privacy.html'),
        '<!doctype html><title>Privacy · Grotto</title><h1>Privacy</h1>'
    );
    mkdirSync(join(staticAppRoot, 'assets'));
    writeFileSync(join(staticAppRoot, 'assets', 'app.js'), 'window.__grotto = true;');

    application = await createGrottoServerApplication({
        appOrigin,
        attachmentRoot,
        clerkIssuerUrl: clerk.url,
        databaseUrl: cluster.databaseUrl,
        staticAppRoot,
    });
    await application.listen(0);
});

test('serves the Server UI assets from the same origin', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/assets/app.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('window.__grotto = true;');
});

test('serves the public privacy page with its security policy', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/privacy`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toContain('<h1>Privacy</h1>');
});

test('serves the trailing-slash privacy URL instead of the Server UI shell', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/privacy/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Privacy · Grotto</title>');
});

afterAll(async () => {
    await application.close();
    await clerk.close();
    await cluster.stop();
    rmSync(attachmentRoot, { force: true, recursive: true });
    rmSync(staticAppRoot, { force: true, recursive: true });
});

test('serves the Server UI history route from a loopback-only Server', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/s/grotto-hq`, {
        headers: { accept: 'text/html' },
    });

    expect(address.address).toBe('127.0.0.1');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Grotto</title>');
});
