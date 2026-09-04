import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { chatMessagesTable } from './chat-messages.ts';
import { reminderFiresTable, remindersTable } from './reminders.ts';
import { serversTable } from './servers.ts';
import { triggerFiresTable, triggersTable } from './triggers.ts';

/**
 * Why an Agent wrote one message. A Trigger or Reminder fire writes nothing to
 * the transcript any more, so the Agent's own reply is the only chat-visible
 * trace of the fire and this row is its provenance: one message answers at most
 * one fire, and every fire the Agent acts on gets its own message.
 *
 * Deleting the message removes the cause. Deleting the automation removes the
 * cause too — the CHECK cannot hold with a null half, so provenance disappears
 * with the automation while the message itself stays in the transcript.
 */
export const messageCausesTable = pgTable(
    'message_causes',
    {
        /**
         * `explicit` when the Agent named the fire with `--cause`; `inferred`
         * when the fire was the only item its run was offered and the answer
         * landed in the fire's anchor Chat.
         */
        attribution: text('attribution').notNull().$type<'explicit' | 'inferred'>(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        kind: text('kind').notNull().$type<'reminder_fire' | 'trigger_fire'>(),
        messageId: text('message_id').primaryKey(),
        reminderFireId: text('reminder_fire_id'),
        reminderId: text('reminder_id'),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        triggerFireId: text('trigger_fire_id'),
        triggerId: text('trigger_id'),
    },
    (table) => [
        index('message_causes_trigger_fire_idx').on(table.serverId, table.triggerFireId),
        index('message_causes_reminder_fire_idx').on(table.serverId, table.reminderFireId),
        foreignKey({
            columns: [table.serverId, table.messageId],
            foreignColumns: [chatMessagesTable.serverId, chatMessagesTable.id],
            name: 'message_causes_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.triggerId],
            foreignColumns: [triggersTable.serverId, triggersTable.id],
            name: 'message_causes_trigger_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.triggerFireId],
            foreignColumns: [triggerFiresTable.serverId, triggerFiresTable.id],
            name: 'message_causes_trigger_fire_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.reminderId],
            foreignColumns: [remindersTable.serverId, remindersTable.id],
            name: 'message_causes_reminder_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.reminderFireId],
            foreignColumns: [reminderFiresTable.serverId, reminderFiresTable.id],
            name: 'message_causes_reminder_fire_fk',
        }).onDelete('cascade'),
        check('message_causes_attribution', sql`${table.attribution} in ('explicit', 'inferred')`),
        check('message_causes_kind', sql`${table.kind} in ('reminder_fire', 'trigger_fire')`),
        check(
            'message_causes_shape',
            sql`(
                ${table.kind} = 'trigger_fire'
                and ${table.triggerId} is not null
                and ${table.triggerFireId} is not null
                and ${table.reminderId} is null
                and ${table.reminderFireId} is null
            ) or (
                ${table.kind} = 'reminder_fire'
                and ${table.reminderId} is not null
                and ${table.reminderFireId} is not null
                and ${table.triggerId} is null
                and ${table.triggerFireId} is null
            )`
        ),
    ]
);
