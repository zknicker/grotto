import { sql } from 'drizzle-orm';
import {
    boolean,
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
import { chatsTable } from './chats.ts';
import { serversTable } from './servers.ts';

/**
 * Durable per-Agent delivery state: the human Stop flag plus the single
 * in-flight run. Serialization is per Agent — one row, one active run — so
 * different Agents on one Computer run concurrently without a Computer-wide
 * queue. `acceptedAt` records the Computer's local-acceptance ack; a null
 * `acceptedAt` on an active run is what the retry sweep resends.
 */
export const agentDeliveryTable = pgTable(
    'agent_delivery',
    {
        acceptedAt: timestamp('accepted_at', { withTimezone: true }),
        activeRunChatId: text('active_run_chat_id'),
        activeRunComputerId: text('active_run_computer_id'),
        activeRunId: text('active_run_id'),
        activeRunModelId: text('active_run_model_id'),
        activeRunRuntimeId: text('active_run_runtime_id'),
        agentChainTurns: integer('agent_chain_turns').notNull().default(0),
        agentId: text('agent_id').primaryKey(),
        consecutiveFailures: integer('consecutive_failures').notNull().default(0),
        dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
        retryAfter: timestamp('retry_after', { withTimezone: true }),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        stopped: boolean('stopped').notNull().default(false),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_delivery_agent_fk',
        }).onDelete('cascade'),
        check('agent_delivery_nonnegative_chain_turns', sql`${table.agentChainTurns} >= 0`),
        check('agent_delivery_nonnegative_failures', sql`${table.consecutiveFailures} >= 0`),
        check(
            'agent_delivery_active_run',
            sql`(
                ${table.activeRunId} is null
                and ${table.activeRunChatId} is null
                and ${table.activeRunComputerId} is null
                and ${table.activeRunRuntimeId} is null
                and ${table.activeRunModelId} is null
                and ${table.acceptedAt} is null
                and ${table.dispatchedAt} is null
            ) or (
                ${table.activeRunId} is not null
                and ${table.activeRunChatId} is not null
                and ${table.activeRunComputerId} is not null
                and ${table.activeRunRuntimeId} is not null
                and ${table.activeRunModelId} is not null
            )`
        ),
    ]
);

/**
 * The durable pending inbox. Each row is one unit of model-visible work waiting
 * for a turn. A queued row has a null `runId`; a drain claims queued rows into
 * one run by stamping its `runId`. A settled run deletes its claimed rows (the
 * model saw them); a failed or stopped run clears the stamp to requeue them, so
 * work is never lost or shown twice.
 */
export const agentPendingWorkTable = pgTable(
    'agent_pending_work',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        content: text('content').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        dedupeKey: text('dedupe_key').notNull(),
        id: text('id').primaryKey(),
        pierced: boolean('pierced').notNull().default(false),
        runId: text('run_id'),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        source: text('source').notNull().default('human'),
    },
    (table) => [
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'agent_pending_work_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'agent_pending_work_chat_fk',
        }).onDelete('cascade'),
        uniqueIndex('agent_pending_work_dedupe_key').on(
            table.serverId,
            table.agentId,
            table.dedupeKey
        ),
        index('agent_pending_work_queue_idx').on(table.serverId, table.agentId, table.createdAt),
        check('agent_pending_work_id_shape', sql`${table.id} ~ '^apw_[A-Za-z0-9_-]{16}$'`),
    ]
);
