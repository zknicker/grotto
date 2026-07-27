import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { chatsTable } from './chats.ts';
import { computersTable } from './computers.ts';
import { serversTable } from './servers.ts';

/**
 * Hosted Agent identity plus Server-owned desired execution configuration and
 * the Computer's last-reported effective state. Desired config survives Computer
 * downtime; effective state is what the assigned Computer actually resolved.
 */
export const agentsTable = pgTable(
    'agents',
    {
        computerId: text('computer_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        desiredModelId: text('desired_model_id'),
        desiredRuntimeId: text('desired_runtime_id'),
        displayName: text('display_name').notNull(),
        effectiveMissing: jsonb('effective_missing').$type<string[]>(),
        effectiveModelId: text('effective_model_id'),
        effectiveReportedAt: timestamp('effective_reported_at', { withTimezone: true }),
        effectiveRuntimeId: text('effective_runtime_id'),
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
        foreignKey({
            columns: [table.serverId, table.computerId],
            foreignColumns: [computersTable.serverId, computersTable.id],
            name: 'agents_computer_fk',
        }),
        check('agents_role', sql`${table.role} in ('admin', 'member')`),
        check(
            'agents_configuration',
            sql`(
                (${table.computerId} is null and ${table.desiredRuntimeId} is null and ${table.desiredModelId} is null)
                or (${table.computerId} is not null and ${table.desiredRuntimeId} is not null and ${table.desiredModelId} is not null)
            )`
        ),
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
