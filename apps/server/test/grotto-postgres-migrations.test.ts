import { afterAll, beforeAll, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { migrateGrottoDatabase } from '../src/postgres/migrations.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let cluster: PostgresCluster;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
});

afterAll(async () => {
    await cluster.stop();
});

test('creates the baseline once and keeps repeated deploys idempotent', async () => {
    await expect(
        migrateGrottoDatabase(cluster.databaseUrl, 'not-a-role', 'grotto')
    ).rejects.toThrow('plain PostgreSQL identifier');
    await expect(migrateGrottoDatabase(cluster.databaseUrl, 'grotto', 'grotto')).resolves.toEqual(
        []
    );
    await expect(migrateGrottoDatabase(cluster.databaseUrl, 'grotto', 'grotto')).resolves.toEqual(
        []
    );

    const database = new SQL(cluster.databaseUrl);
    try {
        const rows = (await database`
            SELECT count(*)::int AS total
            FROM drizzle.__drizzle_migrations
        `) as { total: number }[];
        const servers = (await database`SELECT count(*)::int AS total FROM servers`) as {
            total: number;
        }[];

        expect(rows).toEqual([{ total: 8 }]);
        expect(servers).toEqual([{ total: 0 }]);
    } finally {
        await database.close();
    }
});

test('reports the exact migrations applied to a fresh database', async () => {
    const database = new SQL(cluster.databaseUrl);
    const databaseName = 'grotto_migration_report_test';
    const databaseUrl = new URL(cluster.databaseUrl);
    databaseUrl.pathname = `/${databaseName}`;

    try {
        await database.unsafe(`CREATE DATABASE ${databaseName}`);
        await expect(
            migrateGrottoDatabase(databaseUrl.toString(), 'grotto', 'grotto')
        ).resolves.toEqual([
            '0000_baseline',
            '0001_chat-anchor-fk',
            '0002_defer-server-purge-constraints',
            '0003_inbox-notice-state',
            '0004_lifecycle-created-updated',
            '0005_dm-pair-c-collation',
            '0006_striped_randall_flagg',
            '0007_organic_killmonger',
        ]);
    } finally {
        await database.unsafe(`DROP DATABASE IF EXISTS ${databaseName}`);
        await database.close();
    }
});
