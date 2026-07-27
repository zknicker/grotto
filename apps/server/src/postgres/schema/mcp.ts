import {
    boolean,
    foreignKey,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { computersTable } from './computers.ts';
import { serversTable } from './servers.ts';

export const mcpConnectionsTable = pgTable(
    'mcp_connections',
    {
        accountLabel: text('account_label'),
        args: text('args').array().notNull(),
        auth: text('auth').notNull().$type<'headers' | 'none' | 'oauth'>(),
        command: text('command'),
        computerId: text('computer_id').notNull(),
        connected: boolean('connected').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        headerNames: text('header_names').array().notNull(),
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        preset: text('preset').$type<'google-calendar' | 'merchbase' | null>(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        tools: text('tools').array().notNull(),
        transport: text('transport').notNull().$type<'http' | 'stdio'>(),
        url: text('url'),
    },
    (table) => [
        uniqueIndex('mcp_connections_server_id_key').on(table.serverId, table.id),
        foreignKey({
            columns: [table.serverId, table.computerId],
            foreignColumns: [computersTable.serverId, computersTable.id],
            name: 'mcp_connections_computer_fk',
        }),
    ]
);

export const agentMcpToolGrantsTable = pgTable(
    'agent_mcp_tool_grants',
    {
        agentId: text('agent_id').notNull(),
        connectionId: text('connection_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        serverId: text('server_id').notNull(),
        toolName: text('tool_name').notNull(),
    },
    (table) => [
        primaryKey({
            columns: [table.serverId, table.agentId, table.connectionId, table.toolName],
        }),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_mcp_tool_grants_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.connectionId],
            foreignColumns: [mcpConnectionsTable.serverId, mcpConnectionsTable.id],
            name: 'agent_mcp_tool_grants_connection_fk',
        }).onDelete('cascade'),
    ]
);
