import { TRIGGER_HISTORY_RETENTION_DAYS } from '@grotto/api';
import { and, eq, isNotNull, lt, ne, notExists } from 'drizzle-orm';
import { type BootSweep, type SweepTimers, startBootSweep } from '../boot-sweep.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentInboxTable, triggerFiresTable, triggersTable } from '../postgres/schema.ts';
import type { TriggerClock } from './trigger-model.ts';

const sweepIntervalMs = 60 * 60 * 1000;
const retentionMs = TRIGGER_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Deletes expired Trigger history without deleting an Agent's unfinished work.
 * Removed Trigger rows are tombstones: the parent waits for the same window
 * after removal, while each fire expires on its own received-at clock. A
 * non-seen trigger inbox row keeps both records until the Agent settles it.
 */
export async function deleteExpiredTriggerHistory(
    db: GrottoDatabase,
    now: Date
): Promise<string[]> {
    const expiredBefore = new Date(now.getTime() - retentionMs);
    const triggerAwake = db
        .select({ id: agentInboxTable.id })
        .from(agentInboxTable)
        .innerJoin(
            triggerFiresTable,
            and(
                eq(triggerFiresTable.serverId, agentInboxTable.serverId),
                eq(triggerFiresTable.id, agentInboxTable.dedupeKey),
                eq(triggerFiresTable.triggerId, triggersTable.id),
                eq(triggerFiresTable.serverId, triggersTable.serverId)
            )
        )
        .where(
            and(
                eq(agentInboxTable.source, 'trigger'),
                ne(agentInboxTable.state, 'seen'),
                eq(triggerFiresTable.serverId, triggersTable.serverId),
                eq(triggerFiresTable.triggerId, triggersTable.id)
            )
        );
    const deleted = await db
        .delete(triggersTable)
        .where(
            and(
                isNotNull(triggersTable.deletedAt),
                lt(triggersTable.deletedAt, expiredBefore),
                notExists(triggerAwake)
            )
        )
        .returning({ id: triggersTable.id });

    const fireAwake = db
        .select({ id: agentInboxTable.id })
        .from(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.serverId, triggerFiresTable.serverId),
                eq(agentInboxTable.dedupeKey, triggerFiresTable.id),
                eq(agentInboxTable.source, 'trigger'),
                ne(agentInboxTable.state, 'seen')
            )
        );
    await db
        .delete(triggerFiresTable)
        .where(and(lt(triggerFiresTable.receivedAt, expiredBefore), notExists(fireAwake)));
    return deleted.map((row) => row.id);
}

/** Runs retention on boot and hourly after that. */
export function startTriggerRetentionSweep(
    db: GrottoDatabase,
    clock: TriggerClock,
    timers?: SweepTimers
): BootSweep {
    return startBootSweep({
        intervalMs: sweepIntervalMs,
        name: 'trigger history retention sweep',
        run: () => deleteExpiredTriggerHistory(db, clock.now()),
        timers,
    });
}
