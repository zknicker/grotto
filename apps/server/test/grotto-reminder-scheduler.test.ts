import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HostedAgentCommand } from '@tavern/api';
import { eq, sql } from 'drizzle-orm';
import { AgentDelivery, type DeliveryTransport } from '../src/agent-delivery/delivery.ts';
import { createGrottoServerApplication } from '../src/grotto-server-application.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatMessagesTable,
    chatsTable,
    computersTable,
    reminderAgentAttentionTable,
    reminderFiresTable,
    remindersTable,
    serverMembershipsTable,
    serversTable,
    usersTable,
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
let attachmentRoot: string | null = null;

afterEach(async () => {
    await connection?.close();
    await clerk?.close();
    await cluster?.stop();
    if (attachmentRoot) {
        await rm(attachmentRoot, { force: true, recursive: true });
    }
    connection = null;
    clerk = null;
    cluster = null;
    attachmentRoot = null;
});

describe('hosted reminder scheduler lifecycle', () => {
    test('fresh schema indexes the global scheduled-due scan', async () => {
        cluster = await startPostgresCluster();
        await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
        connection = await connectGrottoDatabase(cluster.databaseUrl);

        const result = await connection.db.execute(sql`
            select indexdef
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'reminders'
              and indexname = 'reminders_due_idx'
        `);

        expect(result).toHaveLength(1);
        expect(result[0]?.indexdef).toContain('(fire_at, id)');
        expect(result[0]?.indexdef).toContain("WHERE (status = 'scheduled'::text)");
    });

    test('recovers one overdue fire on startup and does not burst after restart', async () => {
        cluster = await startPostgresCluster();
        await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
        clerk = await startClerkTestIssuer(appOrigin);
        connection = await connectGrottoDatabase(cluster.databaseUrl);
        attachmentRoot = await mkdtemp(join(tmpdir(), 'grotto-reminder-attachments-'));
        await seedOverdueReminder(connection);
        await connection.close();
        connection = null;

        const first = await createGrottoServerApplication({
            appOrigin,
            attachmentRoot,
            clerkIssuerUrl: clerk.url,
            databaseUrl: cluster.databaseUrl,
            reminderClock: { now: () => now },
            reminderSchedulerTimers: inertTimers,
        });
        const firstHealth = await first.app.inject({ method: 'GET', url: '/healthz' });
        await first.close();

        const restarted = await createGrottoServerApplication({
            appOrigin,
            attachmentRoot,
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
        await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
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

    test('dispatches script fires to Computer and wakes the Agent only for output', async () => {
        cluster = await startPostgresCluster();
        await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
        connection = await connectGrottoDatabase(cluster.databaseUrl);
        await seedOverdueReminder(connection);
        await configureHostedComputer(connection);
        await connection.db
            .update(remindersTable)
            .set({ repeat: null, script: 'printf changed' })
            .where(eq(remindersTable.id, 'rem_scheduler'));

        const transport = new RecordingTransport();
        const delivery = new AgentDelivery(connection.db, transport);
        await tickHostedReminders(connection.db, { now: () => now }, delivery);

        const command = transport.frames.find((frame) => frame.type === 'reminder-script');
        expect(command).toMatchObject({
            agentId: 'agt_scheduler',
            script: 'printf changed',
            type: 'reminder-script',
        });
        if (!command || command.type !== 'reminder-script') {
            throw new Error('Reminder script did not dispatch.');
        }
        expect(transport.frames.some((frame) => frame.type === 'start')).toBe(false);

        await delivery.onReminderScriptResult('cmp_ssssssssssssssss', {
            agentId: command.agentId,
            attentionId: command.attentionId,
            exitCode: 0,
            fireId: command.fireId,
            output: 'changed',
            timedOut: false,
            type: 'reminder-script-result',
        });
        expect(transport.frames.some((frame) => frame.type === 'start')).toBe(true);
        expect(await connection.db.select().from(reminderAgentAttentionTable)).toHaveLength(0);
        const [fire] = await connection.db.select().from(reminderFiresTable);
        expect(fire).toMatchObject({
            scriptExitCode: 0,
            scriptOutput: 'changed',
            scriptTimedOut: false,
        });
    });
});

class RecordingTransport implements DeliveryTransport {
    readonly frames: HostedAgentCommand[] = [];

    isOnline(computerId: string): boolean {
        return computerId === 'cmp_ssssssssssssssss';
    }

    send(computerId: string, frame: HostedAgentCommand): boolean {
        if (!this.isOnline(computerId)) {
            return false;
        }
        this.frames.push(frame);
        return true;
    }
}

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

async function configureHostedComputer(grotto: GrottoConnection) {
    await grotto.db
        .insert(usersTable)
        .values({ clerkUserId: 'clerk_scheduler', id: 'usr_scheduler' });
    await grotto.db.insert(serverMembershipsTable).values({
        id: 'mem_scheduler',
        role: 'owner',
        serverId: 'srv_scheduler',
        userId: 'usr_scheduler',
    });
    await grotto.db.insert(computersTable).values({
        attachedByUserId: 'usr_scheduler',
        credentialHash: 'a'.repeat(64),
        id: 'cmp_ssssssssssssssss',
        serverId: 'srv_scheduler',
    });
    await grotto.db
        .update(agentsTable)
        .set({
            computerId: 'cmp_ssssssssssssssss',
            desiredModelId: 'fake-model',
            desiredRuntimeId: 'fake',
        })
        .where(eq(agentsTable.id, 'agt_scheduler'));
}
