import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { bunJsonb } from './bun-jsonb.ts';
import { chatsTable } from './chats.ts';
import { preparedActionsTable } from './prepared-actions.ts';
import { serversTable } from './servers.ts';

/**
 * Record-only handoff from a committed action to the future terminal-attention
 * delivery path. PRD-261 writes this atomically; PRD-262 owns delivery.
 */
export const agentActionAttentionsTable = pgTable(
    'agent_action_attentions',
    {
        actionId: text('action_id').notNull(),
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        createdAgentId: text('created_agent_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        dedupeKey: text('dedupe_key').notNull(),
        executedResult: bunJsonb('executed_result').notNull(),
        id: text('id').primaryKey(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        source: text('source').notNull().default('action').$type<'action'>(),
    },
    (table) => [
        unique('agent_action_attentions_server_action_key').on(table.serverId, table.actionId),
        unique('agent_action_attentions_server_dedupe_key').on(
            table.serverId,
            table.agentId,
            table.dedupeKey
        ),
        index('agent_action_attentions_agent_idx').on(
            table.serverId,
            table.agentId,
            table.createdAt
        ),
        foreignKey({
            columns: [table.serverId, table.actionId],
            foreignColumns: [preparedActionsTable.serverId, preparedActionsTable.id],
            name: 'agent_action_attentions_action_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_action_attentions_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'agent_action_attentions_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.createdAgentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_action_attentions_created_agent_fk',
        }).onDelete('cascade'),
        check('agent_action_attentions_id_shape', sql`${table.id} ~ '^aat_[A-Za-z0-9_-]{16}$'`),
        check('agent_action_attentions_source', sql`${table.source} = 'action'`),
    ]
);
