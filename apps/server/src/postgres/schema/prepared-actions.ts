import type { PreparedActionStatus } from '@grotto/api';
import { sql } from 'drizzle-orm';
import {
    check,
    customType,
    foreignKey,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { chatMessagesTable } from './chat-messages.ts';
import { chatsTable } from './chats.ts';
import { serverMembershipsTable } from './server-memberships.ts';

const bunJsonb = customType<{ data: unknown; driverData: unknown }>({
    dataType: () => 'jsonb',
});

const bunBytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
    dataType: () => 'bytea',
});

export const preparedActionsTable = pgTable(
    'prepared_actions',
    {
        chatId: text('chat_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        executedAt: timestamp('executed_at', { withTimezone: true }),
        executedByUserId: text('executed_by_user_id'),
        executedResult: bunJsonb('executed_result'),
        id: text('id').primaryKey(),
        kind: text('kind').notNull(),
        messageId: text('message_id').notNull(),
        nonce: text('nonce').notNull(),
        proposal: bunJsonb('proposal').notNull(),
        proposerAgentId: text('proposer_agent_id').notNull(),
        serverId: text('server_id').notNull(),
        status: text('status').notNull().default('pending').$type<PreparedActionStatus>(),
        supersededAt: timestamp('superseded_at', { withTimezone: true }),
        supersededByActionId: text('superseded_by_action_id'),
    },
    (table) => [
        unique('prepared_actions_server_id_key').on(table.serverId, table.id),
        uniqueIndex('prepared_actions_message_key').on(
            table.serverId,
            table.chatId,
            table.messageId
        ),
        uniqueIndex('prepared_actions_nonce_key').on(
            table.serverId,
            table.proposerAgentId,
            table.nonce
        ),
        index('prepared_actions_pending_idx')
            .on(table.serverId, table.chatId, table.proposerAgentId, table.kind, table.createdAt)
            .where(sql`${table.status} = 'pending'`),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'prepared_actions_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId, table.messageId],
            foreignColumns: [
                chatMessagesTable.serverId,
                chatMessagesTable.chatId,
                chatMessagesTable.id,
            ],
            name: 'prepared_actions_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.proposerAgentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'prepared_actions_proposer_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.executedByUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'prepared_actions_executor_membership_fk',
        }),
        check('prepared_actions_id_shape', sql`${table.id} ~ '^act_[A-Za-z0-9_-]{16}$'`),
        check(
            'prepared_actions_status',
            sql`${table.status} in ('pending', 'executed', 'superseded')`
        ),
        check(
            'prepared_actions_superseded_shape',
            sql`(${table.status} = 'superseded') = (${table.supersededAt} is not null and ${table.supersededByActionId} is not null)`
        ),
    ]
);

export const preparedActionMediaTable = pgTable(
    'prepared_action_media',
    {
        actionId: text('action_id').notNull(),
        byteSize: integer('byte_size').notNull(),
        bytes: bunBytea('bytes').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        mediaType: text('media_type').notNull().$type<'image/jpeg' | 'image/png' | 'image/webp'>(),
        sha256: text('sha256').notNull(),
        serverId: text('server_id').notNull(),
    },
    (table) => [
        unique('prepared_action_media_server_id_key').on(table.serverId, table.id),
        uniqueIndex('prepared_action_media_action_key').on(table.serverId, table.actionId),
        foreignKey({
            columns: [table.serverId, table.actionId],
            foreignColumns: [preparedActionsTable.serverId, preparedActionsTable.id],
            name: 'prepared_action_media_action_fk',
        }).onDelete('cascade'),
        check('prepared_action_media_id_shape', sql`${table.id} ~ '^pam_[A-Za-z0-9_-]{16}$'`),
        check(
            'prepared_action_media_type',
            sql`${table.mediaType} in ('image/jpeg', 'image/png', 'image/webp')`
        ),
        check(
            'prepared_action_media_size',
            sql`${table.byteSize} > 0 and ${table.byteSize} <= 524288`
        ),
        check('prepared_action_media_sha256', sql`${table.sha256} ~ '^[a-f0-9]{64}$'`),
    ]
);
