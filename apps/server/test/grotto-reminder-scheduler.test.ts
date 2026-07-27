import { afterEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createGrottoServerApplication } from '../src/grotto-server-application.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatMessagesTable,
    chatsTable,
    reminderFiresTable,
    remindersTable,
    serversTable,
} from '../src/postgres/schema.ts';
import { createHostedReminderScheduler } from '../src/reminders/reminder-scheduler.ts';
import { tickHostedReminders } from '../src/reminders/scheduler.ts';
import { type ClerkTestIssuer, startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

const appOrigin = 'https://app.grotto.test';
const dueAt = new Date('2026-07-26T13:00:00.000Z');
const now = new Date('2026-07-26T14:00:00.000Z');
let clerk: ClerkTestIssuer | null = null;
let cluster: PostgresCluster | null = null;
let connection: GrottoConnection | null = null;

afterEach(async () => {
    await connection?.close();
    await clerk?.close();
    await cluster?.stop();
    connection = null;
    clerk = null;
    cluster = null;
});

describe('hosted reminder scheduler lifecycle', () => {
    test('recovers one overdue fire on startup and does not burst after restart', async () => {
        cluster = await startPostgresCluster();
        clerk = await startClerkTestIssuer(appOrigin);
        connection = await connectGrottoDatabase(cluster.databaseUrl);
        await seedOverdueReminder(connection);
        await connection.close();
        connection = null;

        const first = await createGrottoServerApplication({
            appOrigin,
            clerkIssuerUrl: clerk.url,
            databaseUrl: cluster.databaseUrl,
            reminderClock: { now: () => now },
            reminderSchedulerTimers: inertTimers,
        });
        const firstHealth = await first.app.inject({ method: 'GET', url: '/healthz' });
        await first.close();

        const restarted = await createGrottoServerApplication({
            appOrigin,
            clerkIssuerUrl: clerk.url,
            databaseUrl: cluster.databaseUrl,
            reminderClock: { now: () => now },
            reminderSchedulerTimers: inertTimers,
        });
        const restartHealth = await restarted.app.inject({ method: 'GET', url: '/healthz' });
        await restarted.close();

        connection = await connectGrottoDatabase(cluster.databaseUrl);
        const fires = await connection.db.select().from(reminderFiresTable);
        expect(fires).toHaveLength(1);
        expect(fires[0]).toMatchObject({
            firedAt: now,
            scheduledFor: dueAt,
        });
        expect(firstHealth.json()).toEqual({
            reminders: {
                consecutiveFailures: 0,
                lastSuccessfulTickAt: now.toISOString(),
                status: 'healthy',
            },
            status: 'ok',
        });
        expect(restartHealth.json()).toEqual(firstHealth.json());
    });

    test('waits for an in-flight tick during graceful shutdown', async () => {
        const tickStarted = Promise.withResolvers<void>();
        const releaseTick = Promise.withResolvers<void>();
        const scheduler = createHostedReminderScheduler({
            clock: { now: () => now },
            tick: async () => {
                tickStarted.resolve();
                await releaseTick.promise;
            },
            timers: inertTimers,
        });
        const starting = scheduler.start();
        await tickStarted.promise;

        let closed = false;
        const closing = scheduler.close().then(() => {
            closed = true;
        });
        await Promise.resolve();
        expect(closed).toBe(false);

        releaseTick.resolve();
        await Promise.all([starting, closing]);
        expect(closed).toBe(true);
    });

    test('reports failures without exposing their details and recovers on success', async () => {
        let shouldFail = true;
        const scheduler = createHostedReminderScheduler({
            clock: { now: () => now },
            tick: async () => {
                if (shouldFail) {
                    throw new Error('database host and secret details');
                }
            },
            timers: inertTimers,
        });

        await scheduler.start();
        expect(scheduler.health()).toEqual({
            consecutiveFailures: 1,
            lastSuccessfulTickAt: null,
            status: 'degraded',
        });
        expect(JSON.stringify(scheduler.health())).not.toContain('secret');

        shouldFail = false;
        await scheduler.wake();
        expect(scheduler.health()).toEqual({
            consecutiveFailures: 0,
            lastSuccessfulTickAt: now.toISOString(),
            status: 'healthy',
        });
        await scheduler.close();
        expect(scheduler.health()).toEqual({
            consecutiveFailures: 0,
            lastSuccessfulTickAt: now.toISOString(),
            status: 'stopped',
        });
    });

    test('continues past one poisoned reminder and reports the degraded tick', async () => {
        cluster = await startPostgresCluster();
        connection = await connectGrottoDatabase(cluster.databaseUrl);
        await seedOverdueReminder(connection);
        await connection.db
            .update(remindersTable)
            .set({ repeat: 'daily@09:00', timezone: 'Not/A_Timezone' })
            .where(eq(remindersTable.id, 'rem_scheduler'));
        await connection.db.insert(remindersTable).values({
            anchorChatId: 'cht_scheduler',
            anchorMessageId: 'msg_scheduler_anchor',
            createdAt: new Date('2026-07-26T12:00:00.000Z'),
            fireAt: new Date('2026-07-26T13:01:00.000Z'),
            id: 'rem_scheduler_healthy',
            ownerAgentId: 'agt_scheduler',
            serverId: 'srv_scheduler',
            status: 'scheduled',
            timezone: 'America/New_York',
            title: 'Still fires',
            updatedAt: new Date('2026-07-26T12:00:00.000Z'),
        });

        await expect(tickHostedReminders(connection.db, { now: () => now })).rejects.toThrow(
            'could not fire'
        );

        const fires = await connection.db.select().from(reminderFiresTable);
        expect(fires).toHaveLength(1);
        expect(fires[0]?.reminderId).toBe('rem_scheduler_healthy');
    });
});

const inertTimers = {
    clearInterval: (_timer: ReturnType<typeof setInterval>) => undefined,
    setInterval: (_callback: () => void, _milliseconds: number) =>
        Symbol('timer') as unknown as ReturnType<typeof setInterval>,
};

async function seedOverdueReminder(grotto: GrottoConnection) {
    const serverId = 'srv_scheduler';
    const chatId = 'cht_scheduler';
    const agentId = 'agt_scheduler';
    const anchorMessageId = 'msg_scheduler_anchor';
    await grotto.db.insert(serversTable).values({
        displayName: 'Scheduler Server',
        id: serverId,
        slug: 'scheduler-server',
    });
    await grotto.db.insert(chatsTable).values({
        id: chatId,
        isAll: true,
        kind: 'channel',
        lastMessageSequence: 1,
        name: 'all',
        serverId,
    });
    await grotto.db.insert(chatMessagesTable).values({
        chatId,
        content: 'Anchor',
        createdAt: new Date('2026-07-26T12:00:00.000Z'),
        id: anchorMessageId,
        nonce: 'anchor',
        sequence: 1,
        serverId,
        systemAuthor: 'reminder',
    });
    await grotto.db.insert(agentsTable).values({
        displayName: 'Cove',
        handle: 'Cove',
        homeTimezone: 'America/New_York',
        id: agentId,
        role: 'member',
        serverId,
    });
    await grotto.db.insert(channelAgentParticipantsTable).values({
        agentId,
        chatId,
        serverId,
    });
    await grotto.db.insert(remindersTable).values({
        anchorChatId: chatId,
        anchorMessageId,
        createdAt: new Date('2026-07-26T12:00:00.000Z'),
        fireAt: dueAt,
        id: 'rem_scheduler',
        ownerAgentId: agentId,
        repeat: 'every:1h',
        serverId,
        status: 'scheduled',
        timezone: 'America/New_York',
        title: 'Recover me',
        updatedAt: new Date('2026-07-26T12:00:00.000Z'),
    });
}
