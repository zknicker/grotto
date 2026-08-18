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

        expect(rows[0]?.total).toBeGreaterThan(0);
        expect(servers).toEqual([{ total: 0 }]);
    } finally {
        await database.close();
    }
});

test('reports each migration applied to a fresh database exactly once', async () => {
    const database = new SQL(cluster.databaseUrl);
    const databaseName = 'grotto_migration_report_test';
    const databaseUrl = new URL(cluster.databaseUrl);
    databaseUrl.pathname = `/${databaseName}`;

    try {
        await database.unsafe(`CREATE DATABASE ${databaseName}`);
        const applied = await migrateGrottoDatabase(databaseUrl.toString(), 'grotto', 'grotto');
        const migratedDatabase = new SQL(databaseUrl.toString());
        let migrationRows: { total: number }[];
        try {
            migrationRows = (await migratedDatabase`
                    SELECT count(*)::int AS total
                    FROM drizzle.__drizzle_migrations
                `) as { total: number }[];
        } finally {
            await migratedDatabase.close();
        }

        expect(applied.length).toBeGreaterThan(0);
        expect(new Set(applied).size).toBe(applied.length);
        expect(migrationRows).toEqual([{ total: applied.length }]);
        await expect(
            migrateGrottoDatabase(databaseUrl.toString(), 'grotto', 'grotto')
        ).resolves.toEqual([]);
    } finally {
        await database.unsafe(`DROP DATABASE IF EXISTS ${databaseName}`);
        await database.close();
    }
});
