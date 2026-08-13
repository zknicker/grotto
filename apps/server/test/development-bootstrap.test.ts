import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedDevelopmentServer } from '../src/development/seed-server.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import {
    agentsTable,
    avatarsTable,
    chatMessagesTable,
    chatsTable,
    computersTable,
    mcpConnectionsTable,
    messageTasksTable,
    serverOnboardingTable,
    serversTable,
    threadFollowsTable,
    usersTable,
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
    const first = await seedDevelopmentServer(connection.db, 'clerk_dev', options);
    const second = await seedDevelopmentServer(connection.db, 'clerk_dev', options);

    expect(second).toEqual(first);
    expect(await connection.db.select().from(serversTable)).toHaveLength(1);
    expect(await connection.db.select().from(computersTable)).toHaveLength(1);
    expect(await connection.db.select().from(agentsTable)).toHaveLength(2);
    // 3 channels + 2 Agent DMs + 3 threads (a discussion plus one per task)
    expect(await connection.db.select().from(chatsTable)).toHaveLength(8);
    expect(await connection.db.select().from(serverOnboardingTable)).toMatchObject([
        { phase: 'complete', serverId: first.id },
    ]);
    expect(await connection.db.select().from(chatMessagesTable)).toHaveLength(13);
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

// The workspace seeded above is the one an operator opens; assert it carries
// enough to exercise every surface without hand-building data.
test('seeds a demo workspace an operator can actually look at', async () => {
    const agents = await connection.db.select().from(agentsTable);
    const threads = (await connection.db.select().from(chatsTable)).filter(
        (chat) => chat.kind === 'thread'
    );
    const tasks = await connection.db.select().from(messageTasksTable);
    const users = await connection.db.select().from(usersTable);

    // Every Agent is attributed, so the human's Created Agents is populated.
    expect(agents.every((agent) => agent.createdByUserId !== null)).toBe(true);
    expect(agents.map((agent) => agent.displayName).sort()).toEqual(['Blippy', 'Tiny']);

    // Nothing in the demo workspace falls back to initials.
    expect(agents.every((agent) => agent.avatarId !== null)).toBe(true);
    expect(users.every((user) => user.avatarId !== null)).toBe(true);
    expect(await connection.db.select().from(avatarsTable)).toHaveLength(3);

    // Threads are anchored to real channel messages, and one is followed.
    expect(threads).toHaveLength(3);
    expect(threads.every((thread) => thread.anchorMessageId && thread.parentChatId)).toBe(true);
    expect(await connection.db.select().from(threadFollowsTable)).toHaveLength(1);

    // Every task carries its deterministic Thread, or the tasks list refuses
    // to project it at all.
    const threadIds = new Set(threads.map((thread) => thread.id));
    expect(
        tasks.every((task) => threadIds.has(`cht_thr_${task.messageId.replace(/^msg_/u, '')}`))
    ).toBe(true);

    // Two tasks covering both assignee kinds and two statuses.
    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.status).sort()).toEqual(['in_progress', 'todo']);
    expect(tasks.some((task) => task.assigneeAgentId !== null)).toBe(true);
    expect(tasks.some((task) => task.assigneeUserId !== null)).toBe(true);

    // A Server-managed connection the Agent Connections surface can grant.
    expect(await connection.db.select().from(mcpConnectionsTable)).toHaveLength(1);
});
