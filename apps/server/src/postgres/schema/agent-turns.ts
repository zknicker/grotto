import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { computersTable } from './computers.ts';
import { serversTable } from './servers.ts';

/**
 * Compact turn activity reported by a Computer after a launch settles. Durable
 * collaboration and this summary live Server-side; the raw transcript, logs,
 * and workspace stay Computer-local behind the authorized live relay.
 */
export const agentTurnsTable = pgTable(
    'agent_turns',
    {
        agentId: text('agent_id').notNull(),
        computerId: text('computer_id').notNull(),
        endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
        id: text('id').primaryKey(),
        messageCount: integer('message_count').notNull().default(0),
        reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
        runId: text('run_id').notNull(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
        status: text('status').notNull().$type<'completed' | 'failed'>(),
        summary: text('summary').notNull(),
    },
    (table) => [
        uniqueIndex('agent_turns_run_key').on(table.serverId, table.agentId, table.runId),
        index('agent_turns_agent_idx').on(table.serverId, table.agentId, table.reportedAt),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_turns_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.computerId],
            foreignColumns: [computersTable.serverId, computersTable.id],
            name: 'agent_turns_computer_fk',
        }).onDelete('cascade'),
        check('agent_turns_status', sql`${table.status} in ('completed', 'failed')`),
        check('agent_turns_message_count', sql`${table.messageCount} >= 0`),
        check('agent_turns_id_shape', sql`${table.id} ~ '^atn_[A-Za-z0-9_-]{16}$'`),
    ]
);
