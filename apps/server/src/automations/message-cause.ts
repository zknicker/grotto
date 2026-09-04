import type { MessageCauseAttribution } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    messageCausesTable,
    reminderFiresTable,
    remindersTable,
    triggerFiresTable,
    triggersTable,
} from '../postgres/schema.ts';

/** One resolved, owner-checked fire, ready to record against a message. */
export type ResolvedMessageCause =
    | { fireId: string; kind: 'reminder_fire'; reminderId: string }
    | { fireId: string; kind: 'trigger_fire'; triggerId: string };

/** That fire plus how the Server learned the Agent was answering it. */
export interface AttributedMessageCause {
    attribution: MessageCauseAttribution;
    fire: ResolvedMessageCause;
}

/** A `--cause` the Server will not record, with the reason the Agent gets back. */
export class MessageCauseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MessageCauseError';
    }
}

/**
 * Resolves `grotto message send --cause <fireId>` to the fire it names. Fire ids
 * carry their own prefix, so the kind is decided before any lookup. The sending
 * Agent must own the automation: provenance is a claim about who was woken, and
 * one Agent may not attribute its message to another's Trigger or Reminder.
 */
export async function resolveMessageCause(
    db: GrottoDatabase,
    input: { agentId: string; cause: string; serverId: string }
): Promise<ResolvedMessageCause> {
    if (input.cause.startsWith('trf_')) {
        const [row] = await db
            .select({ ownerAgentId: triggersTable.ownerAgentId, triggerId: triggersTable.id })
            .from(triggerFiresTable)
            .innerJoin(
                triggersTable,
                and(
                    eq(triggersTable.serverId, triggerFiresTable.serverId),
                    eq(triggersTable.id, triggerFiresTable.triggerId)
                )
            )
            .where(
                and(
                    eq(triggerFiresTable.serverId, input.serverId),
                    eq(triggerFiresTable.id, input.cause)
                )
            )
            .limit(1);
        if (!row) {
            throw new MessageCauseError(`No Trigger fire ${input.cause} exists on this Server.`);
        }
        if (row.ownerAgentId !== input.agentId) {
            throw new MessageCauseError(
                `Trigger fire ${input.cause} belongs to another Agent's Trigger.`
            );
        }
        return { fireId: input.cause, kind: 'trigger_fire', triggerId: row.triggerId };
    }
    if (input.cause.startsWith('rmf_')) {
        const [row] = await db
            .select({ ownerAgentId: remindersTable.ownerAgentId, reminderId: remindersTable.id })
            .from(reminderFiresTable)
            .innerJoin(
                remindersTable,
                and(
                    eq(remindersTable.serverId, reminderFiresTable.serverId),
                    eq(remindersTable.id, reminderFiresTable.reminderId)
                )
            )
            .where(
                and(
                    eq(reminderFiresTable.serverId, input.serverId),
                    eq(reminderFiresTable.id, input.cause)
                )
            )
            .limit(1);
        if (!row) {
            throw new MessageCauseError(`No Reminder fire ${input.cause} exists on this Server.`);
        }
        if (row.ownerAgentId !== input.agentId) {
            throw new MessageCauseError(
                `Reminder fire ${input.cause} belongs to another Agent's Reminder.`
            );
        }
        return { fireId: input.cause, kind: 'reminder_fire', reminderId: row.reminderId };
    }
    throw new MessageCauseError(
        `${input.cause} is not a Trigger or Reminder fire id; use the fire id from the wake envelope.`
    );
}

export async function insertMessageCause(
    db: GrottoDatabase,
    input: {
        attribution: MessageCauseAttribution;
        cause: ResolvedMessageCause;
        messageId: string;
        serverId: string;
    }
): Promise<void> {
    await db
        .insert(messageCausesTable)
        .values(
            input.cause.kind === 'trigger_fire'
                ? {
                      attribution: input.attribution,
                      kind: 'trigger_fire' as const,
                      messageId: input.messageId,
                      serverId: input.serverId,
                      triggerFireId: input.cause.fireId,
                      triggerId: input.cause.triggerId,
                  }
                : {
                      attribution: input.attribution,
                      kind: 'reminder_fire' as const,
                      messageId: input.messageId,
                      reminderFireId: input.cause.fireId,
                      reminderId: input.cause.reminderId,
                      serverId: input.serverId,
                  }
        )
        .onConflictDoNothing();
}
