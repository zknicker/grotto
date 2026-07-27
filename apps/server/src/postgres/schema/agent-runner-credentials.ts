import { foreignKey, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { chatsTable } from './chats.ts';
import { computersTable } from './computers.ts';
import { serversTable } from './servers.ts';

/**
 * Per-launch runner authority. A Computer mints one scoped credential per Agent
 * launch from its Computer credential and keeps it behind the loopback proxy;
 * the Agent process never sees it. Only the token hash is stored, and the row
 * is revoked when the launch ends so a leaked token fails closed.
 */
export const agentRunnerCredentialsTable = pgTable(
    'agent_runner_credentials',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        computerId: text('computer_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        runId: text('run_id').notNull(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        tokenHash: text('token_hash').notNull().unique(),
    },
    (table) => [
        foreignKey({
            columns: [table.serverId, table.computerId],
            foreignColumns: [computersTable.serverId, computersTable.id],
            name: 'agent_runner_credentials_computer_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_runner_credentials_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'agent_runner_credentials_chat_fk',
        }).onDelete('cascade'),
    ]
);
