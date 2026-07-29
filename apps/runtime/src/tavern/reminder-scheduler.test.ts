import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, listMessages } from './chat-api/index.ts';
import { registerInboxWakeSink } from './delivery-planner.ts';
import { nextFireAtMs, parseCadence, parseSnoozeDuration } from './reminder-cadence.ts';
import { tickReminders } from './reminder-scheduler.ts';
import { boundScriptText } from './reminder-script.ts';
import {
    cancelReminder,
    createReminder,
    getReminderOrThrow,
    listReminderRuns,
    listReminders,
} from './reminder-store.ts';
import { subscribeToRuntimeEvents } from './runtime-events.ts';

describe('reminder cadence', () => {
    it('parses the D4 cadence grammar and rejects junk', () => {
        expect(parseCadence('every:15m')).toEqual({ everyMs: 900_000, kind: 'every' });
        expect(parseCadence('every:2h')).toEqual({ everyMs: 7_200_000, kind: 'every' });
        expect(parseCadence('every:1d')).toEqual({ everyMs: 86_400_000, kind: 'every' });
        expect(parseCadence('daily@09:00')).toEqual({ hour: 9, kind: 'daily', minute: 0 });
        expect(parseCadence('weekly:mon,fri@09:30')).toEqual({
            days: [1, 5],
            hour: 9,
            kind: 'weekly',
            minute: 30,
        });
        for (const junk of ['every:0m', 'daily@25:00', 'weekly:xyz@09:00', 'hourly', '']) {
            expect(parseCadence(junk), junk).toBeNull();
        }
    });

    it('computes wall-clock next fires in a timezone', () => {
        // 2026-07-22 12:00 UTC = 05:00 in Los Angeles (PDT, UTC-7).
        const noonUtc = Date.UTC(2026, 6, 22, 12, 0);
        const next = nextFireAtMs(
            { hour: 9, kind: 'daily', minute: 0 },
            noonUtc,
            'America/Los_Angeles'
        );
        // Next 09:00 PDT is 16:00 UTC the same day.
        expect(next).toBe(Date.UTC(2026, 6, 22, 16, 0));

        // Already past 09:00 local → tomorrow.
        const evening = Date.UTC(2026, 6, 22, 17, 0);
        expect(
            nextFireAtMs({ hour: 9, kind: 'daily', minute: 0 }, evening, 'America/Los_Angeles')
        ).toBe(Date.UTC(2026, 6, 23, 16, 0));

        // Weekly lands on the next listed weekday: 2026-07-22 is a Wednesday;
        // next mon/fri fire is Friday 09:00 PDT.
        expect(
            nextFireAtMs(
                { days: [1, 5], hour: 9, kind: 'weekly', minute: 0 },
                noonUtc,
                'America/Los_Angeles'
            )
        ).toBe(Date.UTC(2026, 6, 24, 16, 0));
    });

    it('parses snooze durations', () => {
        expect(parseSnoozeDuration('30m')).toBe(1_800_000);
        expect(parseSnoozeDuration('2h')).toBe(7_200_000);
        expect(parseSnoozeDuration('1d')).toBe(86_400_000);
        expect(parseSnoozeDuration('soon')).toBeNull();
    });
});

describe('reminder fires', () => {
    let tempRoot = '';
    let woken: string[] = [];

    beforeEach(() => {
        tempRoot = mkdtempSync(path.join(tmpdir(), 'tavern-reminders-'));
        ensureRuntimeSchema(initDb(path.join(tempRoot, 'runtime.sqlite')));
        woken = [];
        registerInboxWakeSink({ wakeAgent: (agentId) => woken.push(agentId) });
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: tempRoot,
            },
        });
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [
                { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: { agentId: 'agt_otto' } },
                {
                    id: 'agt_rival',
                    kind: 'agent',
                    label: 'Rival',
                    metadata: { agentId: 'agt_rival' },
                },
            ],
            title: 'general',
        });
    });

    afterEach(() => {
        registerInboxWakeSink(null);
        closeDb();
        rmSync(tempRoot, { force: true, recursive: true });
    });

    it('fires a plain reminder: system message in the surface, wake for the owner only', async () => {
        const reminder = seedReminder({ fireAtMs: Date.now() - 1000 });

        await tickReminders({ nowMs: Date.now(), timezone: 'UTC' });

        const messages = listMessages('cht_general').messages;
        const fire = messages.at(-1);
        expect(fire?.role).toBe('system');
        expect(fire?.content).toBe('🔔 Reminder: check CI');
        expect(fire?.metadata.runtime).toMatchObject({
            reminderId: reminder.id,
            reminderOwnerAgentId: 'agt_otto',
            source: 'reminder-fire',
        });
        // Only the owner wakes — the rival channel member does not.
        expect(woken).toEqual(['agt_otto']);
        expect(getReminderOrThrow(reminder.id).status).toBe('fired');
        expect(listReminderRuns({ reminderId: reminder.id })[0]).toMatchObject({
            outcome: 'fired',
        });
    });

    it('script reminders: empty output is a quiet tick, output rides the fire', async () => {
        const quiet = seedReminder({ fireAtMs: Date.now() - 1000, script: 'true' });
        const runtimeEvents: string[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => runtimeEvents.push(event.type));
        await tickReminders({
            nowMs: Date.now(),
            runScript: async () => ({ exitCode: 0, stderr: '', stdout: '' }),
            timezone: 'UTC',
        });
        expect(listReminderRuns({ reminderId: quiet.id })[0]).toMatchObject({ outcome: 'quiet' });
        expect(woken).toEqual([]);
        expect(
            listMessages('cht_general').messages.filter((message) => message.role === 'system')
        ).toHaveLength(0);
        expect(runtimeEvents).toContain('reminder.updated');
        unsubscribe();

        const loud = seedReminder({ fireAtMs: Date.now() - 1000, script: 'true' });
        await tickReminders({
            nowMs: Date.now(),
            runScript: async () => ({ exitCode: 0, stderr: '', stdout: 'export is stuck\n' }),
            timezone: 'UTC',
        });
        const fire = listMessages('cht_general').messages.at(-1);
        expect(fire?.content).toBe('🔔 Reminder: check CI\nexport is stuck');
        expect(woken).toEqual(['agt_otto']);
        expect(listReminderRuns({ reminderId: loud.id })[0]).toMatchObject({
            outcome: 'fired',
            output: 'export is stuck',
        });
    });

    it('recurring reminders advance from now, one fire per gap', async () => {
        const nowMs = Date.now();
        const reminder = seedReminder({
            fireAtMs: nowMs - 10 * 3_600_000, // ten hours late (runtime was off)
            repeat: 'every:1h',
        });
        await tickReminders({ nowMs, timezone: 'UTC' });

        const after = getReminderOrThrow(reminder.id);
        expect(after.status).toBe('scheduled');
        expect(after.fireAtMs).toBe(nowMs + 3_600_000);
        expect(listReminderRuns({ reminderId: reminder.id })).toHaveLength(1);
        expect(woken).toEqual(['agt_otto']);
    });

    it('script failures with no output record an error tick without waking', async () => {
        const reminder = seedReminder({ fireAtMs: Date.now() - 1000, script: 'false' });
        await tickReminders({
            nowMs: Date.now(),
            runScript: async () => ({ exitCode: 1, stderr: 'boom', stdout: '' }),
            timezone: 'UTC',
        });
        expect(listReminderRuns({ reminderId: reminder.id })[0]).toMatchObject({
            outcome: 'error',
            scriptExitCode: 1,
            scriptStderr: 'boom',
        });
        expect(woken).toEqual([]);
    });

    it('bounds retained script output and marks truncation', () => {
        const output = boundScriptText('x'.repeat(20_000));

        expect(Buffer.byteLength(output)).toBe(16_384);
        expect(output.endsWith('\n[truncated]')).toBe(true);
    });

    it('drops a script fire canceled while the script is running', async () => {
        const reminder = seedReminder({ fireAtMs: Date.now() - 1000, script: 'slow' });

        await tickReminders({
            nowMs: Date.now(),
            runScript: async () => {
                cancelReminder(reminder.id);
                return { exitCode: 0, stderr: '', stdout: 'too late' };
            },
            timezone: 'UTC',
        });

        expect(getReminderOrThrow(reminder.id).status).toBe('canceled');
        expect(listReminderRuns({ reminderId: reminder.id })).toEqual([]);
        expect(listMessages('cht_general').messages).toEqual([]);
        expect(woken).toEqual([]);
    });

    it('rolls back the message when finalization fails before commit', async () => {
        const reminder = seedReminder({ fireAtMs: Date.now() - 1000 });
        getDb().exec(`
            CREATE TRIGGER fail_reminder_run
            BEFORE INSERT ON reminder_runs
            BEGIN
                SELECT RAISE(ABORT, 'injected finalization failure');
            END;
        `);

        await tickReminders({ nowMs: Date.now(), timezone: 'UTC' });

        expect(getReminderOrThrow(reminder.id).status).toBe('scheduled');
        expect(listReminderRuns({ reminderId: reminder.id })).toEqual([]);
        expect(listMessages('cht_general').messages).toEqual([]);
        expect(woken).toEqual([]);
    });

    function seedReminder(input: { fireAtMs: number; repeat?: string; script?: string }) {
        const anchor = `msg_${crypto.randomUUID().replaceAll('-', '')}`;
        return createReminder({
            anchorChatId: 'cht_general',
            anchorMessageId: anchor,
            fireAtMs: input.fireAtMs,
            ownerAgentId: 'agt_otto',
            repeat: input.repeat ?? null,
            script: input.script ?? null,
            title: 'check CI',
        });
    }
});

describe('reminder store filters', () => {
    let tempRoot = '';
    beforeEach(() => {
        tempRoot = mkdtempSync(path.join(tmpdir(), 'tavern-reminder-store-'));
        ensureRuntimeSchema(initDb(path.join(tempRoot, 'runtime.sqlite')));
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: tempRoot,
            },
        });
        createChat({ id: 'cht_x', kind: 'channel', participants: [], title: 'x' });
    });
    afterEach(() => {
        closeDb();
        rmSync(tempRoot, { force: true, recursive: true });
    });

    it('filters by status list and owner', () => {
        createReminder({
            anchorChatId: 'cht_x',
            anchorMessageId: 'msg_a',
            fireAtMs: Date.now() + 1000,
            ownerAgentId: 'agt_otto',
            title: 'one',
        });
        expect(listReminders({ ownerAgentId: 'agt_otto' })).toHaveLength(1);
        expect(
            listReminders({ ownerAgentId: 'agt_otto', statuses: ['fired', 'canceled'] })
        ).toHaveLength(0);
        expect(listReminders({ ownerAgentId: 'agt_other' })).toHaveLength(0);
    });
});
