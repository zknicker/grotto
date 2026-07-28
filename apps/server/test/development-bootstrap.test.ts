import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedHostedDevelopmentServer } from '../src/development/seed-hosted-server.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    computersTable,
    serversTable,
} from '../src/postgres/schema.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let cluster: PostgresCluster;
let connection: GrottoConnection;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    connection = await connectGrottoDatabase(cluster.databaseUrl);
});

afterAll(async () => {
    await connection?.close();
    await cluster?.stop();
});

test('creates one idempotent Server-owned demo workspace', async () => {
    const computerDataRoot = await mkdtemp(join(tmpdir(), 'grotto-dev-computer-'));
    const options = { computerDataRoot, serverOrigin: 'http://127.0.0.1:43210' };
    const first = await seedHostedDevelopmentServer(connection.db, 'clerk_dev', options);
    const second = await seedHostedDevelopmentServer(connection.db, 'clerk_dev', options);

    expect(second).toEqual(first);
    expect(await connection.db.select().from(serversTable)).toHaveLength(1);
    expect(await connection.db.select().from(computersTable)).toHaveLength(1);
    expect(await connection.db.select().from(agentsTable)).toHaveLength(2);
    expect(await connection.db.select().from(chatsTable)).toHaveLength(4);
    expect(await connection.db.select().from(chatMessagesTable)).toHaveLength(7);
    const [computer] = await connection.db.select().from(computersTable);
    const attachment = JSON.parse(
        await readFile(join(computerDataRoot, 'servers', first.id, 'attachment.json'), 'utf8')
    ) as { computerId: string; serverOrigin: string };
    expect(attachment).toMatchObject({
        computerId: computer?.id,
        serverOrigin: 'http://127.0.0.1:43210',
    });
    await rm(computerDataRoot, { force: true, recursive: true });
});
