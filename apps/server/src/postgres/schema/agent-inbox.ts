import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    integer,
    pgTable,
    primaryKey,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { bunJsonb } from './bun-jsonb.ts';
import { chatMessagesTable } from './chat-messages.ts';
import { chatsTable } from './chats.ts';

export const agentInboxCursorsTable = pgTable(
    'agent_inbox_cursors',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        deliveredUpToSequence: integer('delivered_up_to_sequence').notNull().default(0),
        seenUpToSequence: integer('seen_up_to_sequence').notNull().default(0),
        servedUpToSequence: integer('served_up_to_sequence').notNull().default(0),
        serverId: text('server_id').notNull(),
        sessionGeneration: integer('session_generation').notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        primaryKey({
            columns: [table.serverId, table.agentId, table.sessionGeneration, table.chatId],
        }),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_inbox_cursors_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'agent_inbox_cursors_chat_fk',
        }).onDelete('cascade'),
        check(
            'agent_inbox_cursors_nonnegative',
            sql`${table.deliveredUpToSequence} >= 0
                and ${table.seenUpToSequence} >= 0
                and ${table.servedUpToSequence} >= 0
                and ${table.sessionGeneration} > 0`
        ),
    ]
);

export const agentInboxPiercesTable = pgTable(
    'agent_inbox_pierces',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        messageId: text('message_id').notNull(),
        seenAt: timestamp('seen_at', { withTimezone: true }),
        serverId: text('server_id').notNull(),
        servedAt: timestamp('served_at', { withTimezone: true }),
        sessionGeneration: integer('session_generation').notNull(),
    },
    (table) => [
        primaryKey({
            columns: [
                table.serverId,
                table.agentId,
                table.sessionGeneration,
                table.chatId,
                table.messageId,
            ],
        }),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_inbox_pierces_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'agent_inbox_pierces_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.messageId],
            foreignColumns: [chatMessagesTable.serverId, chatMessagesTable.id],
            name: 'agent_inbox_pierces_message_fk',
        }).onDelete('cascade'),
        check('agent_inbox_pierces_generation', sql`${table.sessionGeneration} > 0`),
    ]
);

export const agentMessageDraftsTable = pgTable(
    'agent_message_drafts',
    {
        agentId: text('agent_id').notNull(),
        attachmentIds: bunJsonb('attachment_ids').notNull().$type<string[]>().default([]),
        chatId: text('chat_id').notNull(),
        content: text('content').notNull(),
        reholdCount: integer('rehold_count').notNull(),
        savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
        serverId: text('server_id').notNull(),
        sessionGeneration: integer('session_generation').notNull(),
    },
    (table) => [
        primaryKey({
            columns: [table.serverId, table.agentId, table.sessionGeneration, table.chatId],
        }),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_message_drafts_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'agent_message_drafts_chat_fk',
        }).onDelete('cascade'),
        check(
            'agent_message_drafts_shape',
            sql`${table.reholdCount} > 0 and ${table.sessionGeneration} > 0`
        ),
    ]
);
