import type { AskStatus } from '@grotto/api';
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { chatMessagesTable } from './chat-messages.ts';
import { chatsTable } from './chats.ts';
import { serverMembershipsTable } from './server-memberships.ts';

/**
 * One Agent-authored request for a named human's decision, anchored to exactly
 * one Message. Composite foreign keys keep the Ask, its Message, its Chat, its
 * addressee, and its answerer inside one Server tenant.
 */
export const asksTable = pgTable(
    'asks',
    {
        addresseeUserId: text('addressee_user_id').notNull(),
        agentId: text('agent_id').notNull(),
        answerMessageId: text('answer_message_id'),
        answeredAt: timestamp('answered_at', { withTimezone: true }),
        answeredByAgentId: text('answered_by_agent_id'),
        answeredByUserId: text('answered_by_user_id'),
        chatId: text('chat_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        messageId: text('message_id').notNull(),
        recommendedStep: text('recommended_step').notNull(),
        serverId: text('server_id').notNull(),
        status: text('status').notNull().default('open').$type<AskStatus>(),
        summary: text('summary').notNull(),
        title: text('title').notNull(),
    },
    (table) => [
        unique('asks_server_id_key').on(table.serverId, table.id),
        unique('asks_message_key').on(table.serverId, table.messageId),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'asks_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId, table.messageId],
            foreignColumns: [
                chatMessagesTable.serverId,
                chatMessagesTable.chatId,
                chatMessagesTable.id,
            ],
            name: 'asks_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.answerMessageId],
            foreignColumns: [chatMessagesTable.serverId, chatMessagesTable.id],
            name: 'asks_answer_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.agentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'asks_agent_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.answeredByAgentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'asks_answered_by_agent_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.addresseeUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'asks_addressee_membership_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.answeredByUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'asks_answered_by_membership_fk',
        }),
        check('asks_id_shape', sql`${table.id} ~ '^ask_[A-Za-z0-9_-]{16}$'`),
        check('asks_status', sql`${table.status} in ('open', 'answered')`),
        check('asks_title_length', sql`char_length(${table.title}) between 1 and 120`),
        check('asks_summary_length', sql`char_length(${table.summary}) between 1 and 500`),
        check('asks_step_length', sql`char_length(${table.recommendedStep}) between 1 and 200`),
        check(
            'asks_settlement_shape',
            sql`(${table.status} = 'answered') = (
                ${table.answeredAt} is not null
                and ${table.answerMessageId} is not null
                and num_nonnulls(${table.answeredByUserId}, ${table.answeredByAgentId}) = 1
            )`
        ),
        index('asks_addressee_open_idx')
            .on(table.serverId, table.addresseeUserId, table.createdAt)
            .where(sql`${table.status} = 'open'`),
    ]
);
