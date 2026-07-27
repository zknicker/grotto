import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { chatsTable } from './chats.ts';
import { serversTable } from './servers.ts';

/** Minimal hosted Agent identity and Chat access required by reminders. */
export const agentsTable = pgTable(
    'agents',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        displayName: text('display_name').notNull(),
        handle: text('handle').notNull(),
        homeTimezone: text('home_timezone').notNull(),
        id: text('id').primaryKey(),
        retiredAt: timestamp('retired_at', { withTimezone: true }),
        role: text('role').notNull().$type<'admin' | 'member'>(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
    },
    (table) => [
        uniqueIndex('agents_server_id_key').on(table.serverId, table.id),
        uniqueIndex('agents_server_handle_key').on(table.serverId, sql`lower(${table.handle})`),
        check('agents_role', sql`${table.role} in ('admin', 'member')`),
    ]
);

export const channelAgentParticipantsTable = pgTable(
    'channel_agent_participants',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        chatKind: text('chat_kind').notNull().default('channel'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        serverId: text('server_id').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.chatId, table.agentId] }),
        foreignKey({
            columns: [table.serverId, table.chatId, table.chatKind],
            foreignColumns: [chatsTable.serverId, chatsTable.id, chatsTable.kind],
            name: 'channel_agent_participants_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'channel_agent_participants_agent_fk',
        }).onDelete('cascade'),
        check('channel_agent_participants_kind', sql`${table.chatKind} = 'channel'`),
    ]
);
