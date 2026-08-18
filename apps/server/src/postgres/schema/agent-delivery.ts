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
 * The durable delivery ledger. `state` is the live-queue gate: only a `queued`
 * row is deliverable, and every queue read filters on it. `noticeRunId` records
 * that an ordinary identity was offered without exposing its body; an exact
 * pull attaches the row to the active run. Settlement retains the rows proven
 * model-visible as `seen` with the settling `settledRunId`, so a turn's
 * delivery outcome — including a turn that produced nothing — stays readable.
 * A failed turn without durable output returns its rows to `queued` to replay.
 */
export const agentPendingWorkTable = pgTable(
    'agent_pending_work',
    {
        /** When the Computer acknowledged the run carrying this row. */
        acceptedAt: timestamp('accepted_at', { withTimezone: true }),
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        content: text('content').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        dedupeKey: text('dedupe_key').notNull(),
        id: text('id').primaryKey(),
        /** Whether this Agent was personally named when the immutable message was planned. */
        mentioned: boolean('mentioned').notNull().default(false),
        /** The Agent turn that was offered this identity without exposing its body. */
        noticeRunId: text('notice_run_id'),
        /** The notice-only turn whose first prompt contained this identity. */
        startNoticeRunId: text('start_notice_run_id'),
        runId: text('run_id'),
        /** When the model was shown this body. */
        seenAt: timestamp('seen_at', { withTimezone: true }),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        servedAt: timestamp('served_at', { withTimezone: true }),
        /** The turn that settled this row as model-visible. */
        settledRunId: text('settled_run_id'),
        source: text('source').notNull().default('human'),
        state: text('state')
            .notNull()
            .default('queued')
            .$type<'queued' | 'accepted' | 'served' | 'seen'>(),
        /** A direct Thread mention changed this recipient's explicit unfollow back to followed. */
        threadFollowReactivated: boolean('thread_follow_reactivated').notNull().default(false),
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
        index('agent_pending_work_queued_idx')
            .on(table.serverId, table.agentId, table.createdAt)
            .where(sql`${table.state} = 'queued'`),
        // The run-scoped serving path. Retention makes the table append-only, so
        // the unsettled predicate keeps this index proportional to live work
        // instead of to the whole ledger.
        index('agent_pending_work_run_idx')
            .on(table.agentId, table.runId)
            .where(sql`${table.state} <> 'seen'`),
        check('agent_pending_work_id_shape', sql`${table.id} ~ '^apw_[A-Za-z0-9_-]{16}$'`),
        check(
            'agent_pending_work_state',
            sql`${table.state} in ('queued', 'accepted', 'served', 'seen')`
        ),
    ]
);
