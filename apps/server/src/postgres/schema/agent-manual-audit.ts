import { sql } from 'drizzle-orm';
import { check, foreignKey, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { serversTable } from './servers.ts';

export const agentManualLookupAuditTable = pgTable(
    'manual_lookup_audit',
    {
        agentId: text('agent_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        intent: text('intent').notNull(),
        operation: text('operation').notNull(),
        query: text('query'),
        reason: text('reason').notNull(),
        runId: text('run_id'),
        runnerId: text('runner_id').notNull(),
        serverId: text('server_id').notNull(),
        topicId: text('topic_id'),
    },
    (table) => [
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'manual_lookup_audit_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId],
            foreignColumns: [serversTable.id],
            name: 'manual_lookup_audit_server_fk',
        }).onDelete('cascade'),
        check('manual_lookup_audit_operation', sql`${table.operation} IN ('get', 'search')`),
        check(
            'manual_lookup_audit_target_shape',
            sql`(${table.operation} = 'get' AND ${table.topicId} IS NOT NULL AND ${table.query} IS NULL) OR (${table.operation} = 'search' AND ${table.topicId} IS NULL AND ${table.query} IS NOT NULL)`
        ),
    ]
);
