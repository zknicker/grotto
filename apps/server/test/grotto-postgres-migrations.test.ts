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
    await migrateGrottoDatabase(cluster.databaseUrl, 'grotto', 'grotto');
    await migrateGrottoDatabase(cluster.databaseUrl, 'grotto', 'grotto');

    const database = new SQL(cluster.databaseUrl);
    try {
        const rows = (await database`
            SELECT count(*)::int AS total
            FROM drizzle.__drizzle_migrations
        `) as { total: number }[];
        const servers = (await database`SELECT count(*)::int AS total FROM servers`) as {
            total: number;
        }[];

        expect(rows).toEqual([{ total: 3 }]);
        expect(servers).toEqual([{ total: 0 }]);
    } finally {
        await database.close();
    }
});
