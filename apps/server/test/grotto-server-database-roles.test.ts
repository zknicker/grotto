import { afterAll, beforeAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SQL } from 'bun';
import {
    createGrottoServerApplication,
    type GrottoServerApplication,
} from '../src/grotto-server-application.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { type ClerkTestIssuer, startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

const appOrigin = 'https://grotto.sh';
const backupRole = 'grotto_backup_test';
const runtimeRole = 'grotto_runtime_test';
let admin: SQL;
let application: GrottoServerApplication;
let clerk: ClerkTestIssuer;
let cluster: PostgresCluster;
let runtimeDatabaseUrl: string;
let attachmentRoot: string;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    admin = new SQL(cluster.databaseUrl);
    await admin.unsafe(`CREATE ROLE ${backupRole} LOGIN`);
    await admin.unsafe(`CREATE ROLE ${runtimeRole} LOGIN`);
    await admin.unsafe(`GRANT CONNECT ON DATABASE grotto_test TO ${runtimeRole}`);
    await admin.unsafe(`GRANT CONNECT ON DATABASE grotto_test TO ${backupRole}`);
    await bootstrapGrottoDatabase(cluster.databaseUrl, runtimeRole, backupRole);

    const runtimeUrl = new URL(cluster.databaseUrl);
    runtimeUrl.username = runtimeRole;
    runtimeDatabaseUrl = runtimeUrl.toString();
    clerk = await startClerkTestIssuer(appOrigin);
    attachmentRoot = await mkdtemp(join(tmpdir(), 'grotto-role-attachments-'));
    application = await createGrottoServerApplication({
        appOrigin,
        attachmentRoot,
        clerkIssuerUrl: clerk.url,
        databaseUrl: runtimeDatabaseUrl,
    });
    await application.listen(0);
});

afterAll(async () => {
    await application.close();
    await clerk.close();
    await admin.close();
    await cluster.stop();
    await rm(attachmentRoot, { force: true, recursive: true });
});

test('boots with a DML-only role that cannot create schema objects', async () => {
    const address = application.app.server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    const psql = spawnSync(
        `${process.env.GROTTO_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@16/bin'}/psql`,
        [
            runtimeDatabaseUrl,
            '--command',
            'CREATE TABLE runtime_role_must_not_create_tables (id text)',
        ],
        { encoding: 'utf8' }
    );

    expect(response.status).toBe(200);
    expect(psql.status).not.toBe(0);
    expect(psql.stderr).toContain('permission denied for schema public');
});

test('grants runtime DML on tables created by later migrations', async () => {
    await admin`CREATE TABLE migration_role_default_privileges (id serial PRIMARY KEY)`;
    const runtime = new SQL(runtimeDatabaseUrl);

    try {
        await runtime`INSERT INTO migration_role_default_privileges DEFAULT VALUES`;
        const rows = (await runtime`
            SELECT id FROM migration_role_default_privileges
        `) as { id: number }[];
        expect(rows).toEqual([{ id: 1 }]);
    } finally {
        await runtime.close();
        await admin`DROP TABLE migration_role_default_privileges`;
    }
});

test('keeps product tables and migration history readable by backups', async () => {
    const backupUrl = new URL(cluster.databaseUrl);
    backupUrl.username = backupRole;
    const backup = new SQL(backupUrl.toString());

    try {
        const tables = (await backup`
            SELECT (SELECT count(*) FROM servers)::int AS servers,
                   (SELECT count(*) FROM drizzle.__drizzle_migrations)::int AS migrations
        `) as { migrations: number; servers: number }[];
        expect(tables).toEqual([{ migrations: 3, servers: 0 }]);
    } finally {
        await backup.close();
    }
});

test('bootstraps one fresh database before the runtime role starts', async () => {
    const databaseName = 'grotto_bootstrap_command_test';
    await admin.unsafe(`CREATE DATABASE ${databaseName}`);
    await admin.unsafe(`GRANT CONNECT ON DATABASE ${databaseName} TO ${runtimeRole}`);
    const bootstrapUrl = new URL(cluster.databaseUrl);
    const runtimeUrl = new URL(cluster.databaseUrl);
    bootstrapUrl.pathname = `/${databaseName}`;
    runtimeUrl.pathname = `/${databaseName}`;
    runtimeUrl.username = runtimeRole;

    const bootstrap = spawnSync('bun', ['src/grotto-server-bootstrap.ts'], {
        cwd: new URL('../', import.meta.url),
        encoding: 'utf8',
        env: {
            ...process.env,
            GROTTO_DATABASE_BOOTSTRAP_URL: bootstrapUrl.toString(),
            GROTTO_DATABASE_BACKUP_ROLE: backupRole,
            GROTTO_DATABASE_RUNTIME_ROLE: runtimeRole,
        },
    });
    const runtimeRead = spawnSync(
        `${process.env.GROTTO_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@16/bin'}/psql`,
        [runtimeUrl.toString(), '--tuples-only', '--command', 'SELECT count(*) FROM servers'],
        { encoding: 'utf8' }
    );

    if (bootstrap.status !== 0) {
        throw new Error(`Bootstrap command failed: ${bootstrap.stderr}`);
    }

    expect(bootstrap.status).toBe(0);
    expect(runtimeRead.status).toBe(0);
    expect(runtimeRead.stdout.trim()).toBe('0');
});

test('refuses to adopt an existing PostgreSQL schema', async () => {
    const databaseName = 'grotto_bootstrap_refusal_test';
    await admin.unsafe(`CREATE DATABASE ${databaseName}`);
    const databaseUrl = new URL(cluster.databaseUrl);
    databaseUrl.pathname = `/${databaseName}`;
    const existing = new SQL(databaseUrl.toString());
    await existing`CREATE TABLE existing_state (id text PRIMARY KEY)`;
    await existing.close();

    const bootstrap = spawnSync('bun', ['src/grotto-server-bootstrap.ts'], {
        cwd: new URL('../', import.meta.url),
        encoding: 'utf8',
        env: {
            ...process.env,
            GROTTO_DATABASE_BOOTSTRAP_URL: databaseUrl.toString(),
            GROTTO_DATABASE_BACKUP_ROLE: backupRole,
            GROTTO_DATABASE_RUNTIME_ROLE: runtimeRole,
        },
    });

    expect(bootstrap.status).toBe(1);
    expect(bootstrap.stderr).toContain('must be empty');
    const verification = new SQL(databaseUrl.toString());
    try {
        const tables = (await verification`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `) as { table_name: string }[];
        expect(tables).toEqual([{ table_name: 'existing_state' }]);
    } finally {
        await verification.close();
    }
});
