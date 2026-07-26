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
import { chatMessagesTable } from './chat-messages.ts';
import { chatsTable } from './chats.ts';
import { serverMembershipsTable } from './server-memberships.ts';

export const chatEventsTable = pgTable(
    'chat_events',
    {
        chatId: text('chat_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        cursor: bigint('cursor', { mode: 'bigint' }).notNull(),
        id: text('id').primaryKey(),
        messageId: text('message_id'),
        readerUserId: text('reader_user_id'),
        sequence: integer('sequence').notNull(),
        serverId: text('server_id').notNull(),
        type: text('event_type').notNull().$type<'chat.read' | 'message.created'>(),
    },
    (table) => [
        uniqueIndex('chat_events_server_cursor_key').on(table.serverId, table.cursor),
        check('chat_events_positive_cursor', sql`${table.cursor} > 0`),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'chat_events_chat_fk',
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
                (${table.type} = 'message.created'
                    AND ${table.messageId} IS NOT NULL
                    AND ${table.readerUserId} IS NULL
                    AND ${table.sequence} > 0)
                OR
                (${table.type} = 'chat.read'
                    AND ${table.messageId} IS NULL
                    AND ${table.readerUserId} IS NOT NULL
                    AND ${table.sequence} >= 0)
            )`
        ),
    ]
);
