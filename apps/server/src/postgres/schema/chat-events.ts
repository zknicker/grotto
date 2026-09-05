import type { PreparedActionStatus } from '@grotto/api';
import { sql } from 'drizzle-orm';
import {
    bigint,
    check,
    foreignKey,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { asksTable } from './asks.ts';
import { chatMessagesTable } from './chat-messages.ts';
import { chatsTable } from './chats.ts';
import { preparedActionsTable } from './prepared-actions.ts';
import { remindersTable } from './reminders.ts';
import { serverMembershipsTable } from './server-memberships.ts';

export const chatEventsTable = pgTable(
    'chat_events',
    {
        askId: text('ask_id'),
        chatId: text('chat_id'),
        chatAction: text('chat_action').$type<
            'archived' | 'created' | 'deleted' | 'unarchived' | 'updated'
        >(),
        actionId: text('action_id'),
        lifecycleChatId: text('lifecycle_chat_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        cursor: bigint('cursor', { mode: 'bigint' }).notNull(),
        id: text('id').primaryKey(),
        labelId: text('label_id'),
        actionStatus: text('action_status').$type<PreparedActionStatus>(),
        messageId: text('message_id'),
        readerUserId: text('reader_user_id'),
        reminderAction: text('reminder_action').$type<
            'canceled' | 'fired' | 'scheduled' | 'snoozed' | 'updated'
        >(),
        reminderId: text('reminder_id'),
        sequence: integer('sequence').notNull(),
        serverId: text('server_id').notNull(),
        type: text('event_type')
            .notNull()
            .$type<
                | 'ask.updated'
                | 'chat.read'
                | 'chat.lifecycle'
                | 'message.created'
                | 'prepared-action.updated'
                | 'reminder.changed'
                | 'task.created'
                | 'task.label.updated'
                | 'task.updated'
                | 'thread.follow.updated'
            >(),
    },
    (table) => [
        uniqueIndex('chat_events_server_cursor_key').on(table.serverId, table.cursor),
        check('chat_events_positive_cursor', sql`${table.cursor} > 0`),
        check(
            'chat_events_lifecycle_shape',
            sql`(${table.type} = 'chat.lifecycle') = (${table.lifecycleChatId} is not null)
                and (${table.type} = 'chat.lifecycle') = (${table.chatAction} is not null)`
        ),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'chat_events_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.askId],
            foreignColumns: [asksTable.serverId, asksTable.id],
            name: 'chat_events_ask_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.reminderId],
            foreignColumns: [remindersTable.serverId, remindersTable.id],
            name: 'chat_events_reminder_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.actionId],
            foreignColumns: [preparedActionsTable.serverId, preparedActionsTable.id],
            name: 'chat_events_prepared_action_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.messageId],
            foreignColumns: [chatMessagesTable.serverId, chatMessagesTable.id],
            name: 'chat_events_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.readerUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'chat_events_reader_membership_fk',
        }).onDelete('cascade'),
        check(
            'chat_events_shape',
            sql`(
                (${table.type} = 'ask.updated'
                    AND ${table.askId} IS NOT NULL
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NOT NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.sequence} > 0)
                OR
                (${table.type} = 'message.created'
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NOT NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} > 0)
                OR
                (${table.type} = 'prepared-action.updated'
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NOT NULL
                    AND ${table.actionId} IS NOT NULL
                    AND ${table.actionStatus} IN ('pending', 'executed', 'superseded')
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} > 0)
                OR
                (${table.type} = 'chat.lifecycle'
                    AND ${table.chatId} IS NULL
                    AND ${table.lifecycleChatId} IS NOT NULL
                    AND ${table.chatAction} IN (
                        'archived', 'created', 'deleted', 'unarchived', 'updated'
                    )
                    AND ${table.messageId} IS NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} = 0)
                OR
                (${table.type} IN ('task.created', 'task.updated')
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NOT NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} > 0)
                OR
                (${table.type} = 'chat.read'
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NOT NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} >= 0)
                OR
                (${table.type} = 'thread.follow.updated'
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NOT NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} >= 0)
                OR
                (${table.type} = 'reminder.changed'
                    AND ${table.chatId} IS NOT NULL
                    AND ${table.messageId} IS NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NOT NULL
                    AND ${table.reminderAction} IN (
                        'scheduled', 'updated', 'snoozed', 'canceled', 'fired'
                    )
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} >= 0)
                OR
                (${table.type} = 'task.label.updated'
                    AND ${table.chatId} IS NULL
                    AND ${table.messageId} IS NULL
                    AND ${table.actionId} IS NULL
                    AND ${table.actionStatus} IS NULL
                    AND ${table.labelId} IS NOT NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.reminderId} IS NULL
                    AND ${table.reminderAction} IS NULL
                    AND ${table.askId} IS NULL
                    AND ${table.sequence} = 0)
            )`
        ),
    ]
);
