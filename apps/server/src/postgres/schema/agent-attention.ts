import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    foreignKey,
    pgTable,
    primaryKey,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { chatsTable } from './chats.ts';

export const agentChannelMutesTable = pgTable(
    'agent_channel_mutes',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        chatKind: text('chat_kind').notNull().default('channel'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        serverId: text('server_id').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.agentId, table.chatId] }),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_channel_mutes_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId, table.chatKind],
            foreignColumns: [chatsTable.serverId, chatsTable.id, chatsTable.kind],
            name: 'agent_channel_mutes_chat_fk',
        }).onDelete('cascade'),
        check('agent_channel_mutes_kind', sql`${table.chatKind} = 'channel'`),
    ]
);

export const agentThreadFollowsTable = pgTable(
    'agent_thread_follows',
    {
        agentId: text('agent_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        followed: boolean('followed').notNull().default(true),
        serverId: text('server_id').notNull(),
        threadChatId: text('thread_chat_id').notNull(),
        threadChatKind: text('thread_chat_kind').notNull().default('thread'),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.agentId, table.threadChatId] }),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_thread_follows_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.threadChatId, table.threadChatKind],
            foreignColumns: [chatsTable.serverId, chatsTable.id, chatsTable.kind],
            name: 'agent_thread_follows_thread_fk',
        }).onDelete('cascade'),
        check('agent_thread_follows_kind', sql`${table.threadChatKind} = 'thread'`),
    ]
);
