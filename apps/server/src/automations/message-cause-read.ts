import { automationSnippetMaxChars, type MessageCause } from '@grotto/api';
import { and, count, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    messageCausesTable,
    reminderFiresTable,
    remindersTable,
    triggersTable,
} from '../postgres/schema.ts';
import { reminderCadenceSummary, triggerKindSummary } from './automation-summary.ts';

/**
 * The provenance mark for each message that has one. The App renders the header
 * mark and its hover card from the message alone, so everything the mark needs
 * — title, status, cadence, counters, instruction snippet — is read here.
 */
export async function readMessageCauses(
    db: GrottoDatabase,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, MessageCause>> {
    if (messageIds.length === 0) {
        return new Map();
    }
    const [triggerRows, reminderRows] = await Promise.all([
        db
            .select({
                attribution: messageCausesTable.attribution,
                fireCount: triggersTable.fireCount,
                fireId: messageCausesTable.triggerFireId,
                id: triggersTable.id,
                instruction: triggersTable.instruction,
                kind: triggersTable.kind,
                lastFiredAt: triggersTable.lastFiredAt,
                messageId: messageCausesTable.messageId,
                ownerAgentId: triggersTable.ownerAgentId,
                status: triggersTable.status,
                title: triggersTable.title,
            })
            .from(messageCausesTable)
            .innerJoin(
                triggersTable,
                and(
                    eq(triggersTable.serverId, messageCausesTable.serverId),
                    eq(triggersTable.id, messageCausesTable.triggerId)
                )
            )
            .where(
                and(
                    eq(messageCausesTable.serverId, serverId),
                    inArray(messageCausesTable.messageId, messageIds)
                )
            ),
        db
            .select({
                attribution: messageCausesTable.attribution,
                fireId: messageCausesTable.reminderFireId,
                id: remindersTable.id,
                lastFiredAt: reminderFiresTable.firedAt,
                messageId: messageCausesTable.messageId,
                ownerAgentId: remindersTable.ownerAgentId,
                repeat: remindersTable.repeat,
                script: remindersTable.script,
                status: remindersTable.status,
                title: remindersTable.title,
            })
            .from(messageCausesTable)
            .innerJoin(
                remindersTable,
                and(
                    eq(remindersTable.serverId, messageCausesTable.serverId),
                    eq(remindersTable.id, messageCausesTable.reminderId)
                )
            )
            .innerJoin(
                reminderFiresTable,
                and(
                    eq(reminderFiresTable.serverId, messageCausesTable.serverId),
                    eq(reminderFiresTable.id, messageCausesTable.reminderFireId)
                )
            )
            .where(
                and(
                    eq(messageCausesTable.serverId, serverId),
                    inArray(messageCausesTable.messageId, messageIds)
                )
            ),
    ]);
    const fireCounts = await countReminderFires(
        db,
        serverId,
        reminderRows.map((row) => row.id)
    );
    const causes = new Map<string, MessageCause>();
    for (const row of triggerRows) {
        if (!row.fireId) {
            continue;
        }
        causes.set(row.messageId, {
            attribution: row.attribution,
            automationId: row.id,
            fireCount: Math.max(row.fireCount, 1),
            fireId: row.fireId,
            instruction: snippet(row.instruction),
            kind: 'trigger',
            lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
            ownerAgentId: row.ownerAgentId,
            status: row.status,
            summary: triggerKindSummary(row.kind),
            title: row.title,
        });
    }
    for (const row of reminderRows) {
        if (!row.fireId) {
            continue;
        }
        causes.set(row.messageId, {
            attribution: row.attribution,
            automationId: row.id,
            fireCount: Math.max(fireCounts.get(row.id) ?? 1, 1),
            fireId: row.fireId,
            instruction: snippet(row.script),
            kind: 'reminder',
            lastFiredAt: row.lastFiredAt.toISOString(),
            ownerAgentId: row.ownerAgentId,
            status: row.status,
            summary: reminderCadenceSummary(row.repeat),
            title: row.title,
        });
    }
    return causes;
}

export async function countReminderFires(
    db: GrottoDatabase,
    serverId: string,
    reminderIds: string[]
): Promise<Map<string, number>> {
    if (reminderIds.length === 0) {
        return new Map();
    }
    const rows = await db
        .select({ reminderId: reminderFiresTable.reminderId, total: count() })
        .from(reminderFiresTable)
        .where(
            and(
                eq(reminderFiresTable.serverId, serverId),
                inArray(reminderFiresTable.reminderId, reminderIds)
            )
        )
        .groupBy(reminderFiresTable.reminderId);
    return new Map(rows.map((row) => [row.reminderId, row.total]));
}

function snippet(value: string | null): string | null {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, automationSnippetMaxChars) : null;
}
