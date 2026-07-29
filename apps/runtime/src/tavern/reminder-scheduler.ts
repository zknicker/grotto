import { formatLocalTime } from '../cli/agent-format.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { insertEvent, publish } from './chat-api/events.ts';
import { createMessageId } from './chat-api/ids.ts';
import { insertMessage } from './chat-api/messages.ts';
import { wakeAgentAfterReminder } from './delivery-planner.ts';
import { recordInboxPierce } from './inbox-cursors.ts';
import { nextFireAtMs, parseCadence } from './reminder-cadence.ts';
import { publishReminderUpdated } from './reminder-events.ts';
import {
    boundScriptText,
    type ReminderScriptRunner,
    runReminderScript,
} from './reminder-script.ts';
import {
    dueReminders,
    markReminderFired,
    type ReminderRecord,
    recordReminderRun,
    rescheduleReminder,
} from './reminder-store.ts';

// Reminder fires (D4): server-owned schedules tick here. A script reminder
// runs its payload locally at zero model cost — empty output records a quiet
// tick; output (or no script) posts a 🔔 system message in the anchored
// surface and wakes the owning agent only.

const TICK_INTERVAL_MS = 15_000;

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

export function installReminderScheduler(): void {
    if (timer) {
        return;
    }
    timer = setInterval(() => {
        if (ticking) {
            return;
        }
        ticking = true;
        void tickReminders({ nowMs: Date.now() })
            .catch((err: unknown) => log.warn('Reminder tick failed', { err }))
            .finally(() => {
                ticking = false;
            });
    }, TICK_INTERVAL_MS);
    timer.unref?.();
}

export function stopReminderScheduler(): void {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

/** One scheduler pass; exported for deterministic tests. */
export async function tickReminders(
    input: {
        nowMs: number;
        runScript?: ReminderScriptRunner;
        timezone?: string;
    },
    db: Database = getDb()
): Promise<void> {
    const due = dueReminders(input.nowMs, db);
    for (const reminder of due) {
        try {
            await fireReminder(reminder, input, db);
        } catch (err) {
            log.warn('Reminder fire failed', { err, reminderId: reminder.id });
        }
    }
}

async function fireReminder(
    reminder: ReminderRecord,
    input: { nowMs: number; runScript?: ReminderScriptRunner; timezone?: string },
    db: Database
): Promise<void> {
    const claimToken = claimReminder(reminder, db);
    if (!claimToken) {
        return;
    }
    let output = '';
    let scriptExitCode: number | null = null;
    let scriptStderr: string | null = null;
    if (reminder.script) {
        try {
            const agent = getStoredAgent(reminder.ownerAgentId, db);
            if (!agent) {
                throw new Error('Owning agent no longer exists.');
            }
            const runner = input.runScript ?? runReminderScript;
            const result = await runner({ cwd: agent.workspaceFolder, script: reminder.script });
            output = boundScriptText(result.stdout).trim();
            scriptExitCode = result.exitCode;
            scriptStderr = result.stderr ? boundScriptText(result.stderr) : null;
        } catch (error) {
            finalizeReminderFire(
                reminder,
                claimToken,
                input,
                {
                    errorMessage: error instanceof Error ? error.message : String(error),
                    outcome: 'error',
                },
                db
            );
            return;
        }
        if (!output) {
            // Quiet tick: logged, no message, no wake — the watchdog economics.
            finalizeReminderFire(
                reminder,
                claimToken,
                input,
                {
                    outcome: scriptExitCode === 0 ? 'quiet' : 'error',
                    ...(scriptExitCode === 0
                        ? {}
                        : { errorMessage: `Script exited ${scriptExitCode}.` }),
                    scriptExitCode,
                    scriptStderr,
                },
                db
            );
            return;
        }
    }
    const content = output
        ? `🔔 Reminder: ${reminder.title}\n${output}`
        : `🔔 Reminder: ${reminder.title}`;
    const finalized = finalizeReminderFire(
        reminder,
        claimToken,
        input,
        {
            content,
            outcome: scriptExitCode !== null && scriptExitCode !== 0 ? 'error' : 'fired',
            ...(scriptExitCode !== null && scriptExitCode !== 0
                ? { errorMessage: `Script exited ${scriptExitCode}.` }
                : {}),
            output: output || null,
            scriptExitCode,
            scriptStderr,
        },
        db
    );
    if (finalized.message) {
        wakeAgentAfterReminder(reminder.ownerAgentId);
    }
}

function claimReminder(reminder: ReminderRecord, db: Database): string | null {
    const claimToken = `firing:${crypto.randomUUID()}`;
    const result = db
        .prepare(
            `UPDATE reminders
             SET updated_at = $claimToken
             WHERE id = $id AND status = 'scheduled' AND fire_at_ms = $fireAtMs
               AND updated_at = $snapshotUpdatedAt`
        )
        .run(
            namedParams({
                claimToken,
                fireAtMs: reminder.fireAtMs,
                id: reminder.id,
                snapshotUpdatedAt: reminder.updatedAt,
            })
        );
    return result.changes === 1 ? claimToken : null;
}

function finalizeReminderFire(
    reminder: ReminderRecord,
    claimToken: string,
    input: { nowMs: number; timezone?: string },
    run: {
        content?: string;
        errorMessage?: string;
        outcome: 'error' | 'fired' | 'quiet';
        output?: string | null;
        scriptExitCode?: number | null;
        scriptStderr?: string | null;
    },
    db: Database
): { message: ReturnType<typeof insertMessage> | null } {
    const cadence = reminder.repeat ? parseCadence(reminder.repeat) : null;
    // Late fires (runtime was off) advance from now, not from the missed
    // slot — one fire per gap, never a burst.
    const timezone = input.timezone ?? resolveHomeTimezone();
    const nextFireAt = cadence ? nextFireAtMs(cadence, input.nowMs, timezone) : null;
    if (!reminderClaimIntact(reminder, claimToken, db)) {
        return { message: null };
    }
    const session = run.content
        ? ensureCurrentAgentSession({ agentId: reminder.ownerAgentId, db })
        : null;
    let event: ReturnType<typeof insertEvent> | null = null;
    const transaction = db.transaction(() => {
        const claimed = db
            .prepare(
                `SELECT 1 FROM reminders
                 WHERE id = $id AND status = 'scheduled' AND fire_at_ms = $fireAtMs
                   AND updated_at = $claimToken`
            )
            .get(
                namedParams({
                    claimToken,
                    fireAtMs: reminder.fireAtMs,
                    id: reminder.id,
                })
            );
        if (!claimed) {
            return { message: null };
        }
        const message = run.content
            ? insertMessage(
                  reminder.anchorChatId,
                  {
                      author_id: 'sys_reminder',
                      content: run.content,
                      id: createMessageId(),
                      metadata: {
                          runtime: {
                              reminderId: reminder.id,
                              reminderOwnerAgentId: reminder.ownerAgentId,
                              source: 'reminder-fire',
                          },
                      },
                      role: 'system',
                  },
                  'sys_reminder',
                  null,
                  db
              )
            : null;
        if (message) {
            event = insertEvent(
                {
                    chatId: reminder.anchorChatId,
                    event: 'message.created',
                    payload: { message },
                },
                db
            );
        }
        recordReminderRun(
            {
                errorMessage: run.errorMessage,
                messageId: message?.id,
                outcome: run.outcome,
                output: run.output,
                reminderId: reminder.id,
                scriptExitCode: run.scriptExitCode,
                scriptStderr: run.scriptStderr,
            },
            db
        );
        if (nextFireAt === null) {
            markReminderFired(reminder.id, db);
        } else {
            rescheduleReminder(reminder.id, nextFireAt, db);
        }
        if (message && session) {
            recordInboxPierce(
                {
                    chatId: reminder.anchorChatId,
                    messageId: message.id,
                    sessionId: session.id,
                },
                db
            );
        }
        return { message };
    });
    const finalized = transaction();
    publishReminderUpdated();
    if (event) {
        publish(event);
    }
    return finalized;
}

function reminderClaimIntact(reminder: ReminderRecord, claimToken: string, db: Database): boolean {
    return Boolean(
        db
            .prepare(
                `SELECT 1 FROM reminders
                 WHERE id = $id AND status = 'scheduled' AND fire_at_ms = $fireAtMs
                   AND updated_at = $claimToken`
            )
            .get(
                namedParams({
                    claimToken,
                    fireAtMs: reminder.fireAtMs,
                    id: reminder.id,
                })
            )
    );
}

/** Human-facing schedule receipt posted into the anchored surface. */
export function reminderScheduleReceipt(reminder: ReminderRecord, ownerHandle: string): string {
    const fires = formatLocalTime(new Date(reminder.fireAtMs).toISOString());
    const repeat = reminder.repeat ? `, repeats ${reminder.repeat}` : '';
    return `🔔 @${ownerHandle} scheduled a reminder: "${reminder.title}" (fires ${fires}${repeat})`;
}
