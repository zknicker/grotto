import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    index,
    integer,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { chatMessagesTable } from './chat-messages.ts';
import { chatsTable } from './chats.ts';
import { serverMembershipsTable } from './server-memberships.ts';
import { taskLabelsTable } from './task-labels.ts';

export const messageTasksTable = pgTable(
    'message_tasks',
    {
        assigneeUserId: text('assignee_user_id'),
        assigneeAgentId: text('assignee_agent_id'),
        chatId: text('chat_id').notNull(),
        claimedAt: timestamp('claimed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        createdByAgentId: text('created_by_agent_id'),
        createdByUserId: text('created_by_user_id'),
        messageId: text('message_id').notNull(),
        number: integer('number').notNull(),
        origin: text('origin').notNull().$type<'composed' | 'converted'>(),
        priority: text('priority')
            .notNull()
            .default('none')
            .$type<'none' | 'urgent' | 'high' | 'medium' | 'low'>(),
        serverId: text('server_id').notNull(),
        status: text('status')
            .notNull()
            .default('todo')
            .$type<'todo' | 'in_progress' | 'in_review' | 'done' | 'closed'>(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        version: integer('version').notNull().default(1),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.messageId] }),
        uniqueIndex('message_tasks_chat_number_key').on(table.serverId, table.chatId, table.number),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'message_tasks_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.chatId, table.messageId],
            foreignColumns: [
                chatMessagesTable.serverId,
                chatMessagesTable.chatId,
                chatMessagesTable.id,
            ],
            name: 'message_tasks_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.createdByUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'message_tasks_creator_membership_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.createdByAgentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'message_tasks_creator_agent_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.assigneeUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'message_tasks_assignee_membership_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.assigneeAgentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'message_tasks_assignee_agent_fk',
        }),
        check(
            'message_tasks_creator_shape',
            sql`num_nonnulls(${table.createdByUserId}, ${table.createdByAgentId}) = 1`
        ),
        check(
            'message_tasks_assignee_shape',
            sql`num_nonnulls(${table.assigneeUserId}, ${table.assigneeAgentId}) <= 1`
        ),
        check('message_tasks_positive_number', sql`${table.number} > 0`),
        check('message_tasks_positive_version', sql`${table.version} > 0`),
        check(
            'message_tasks_status',
            sql`${table.status} in ('todo', 'in_progress', 'in_review', 'done', 'closed')`
        ),
        check(
            'message_tasks_priority',
            sql`${table.priority} in ('none', 'urgent', 'high', 'medium', 'low')`
        ),
        check('message_tasks_origin', sql`${table.origin} in ('composed', 'converted')`),
        check(
            'message_tasks_claim_shape',
            sql`${table.claimedAt} is null or num_nonnulls(${table.assigneeUserId}, ${table.assigneeAgentId}) = 1`
        ),
        index('message_tasks_chat_status_idx').on(table.serverId, table.chatId, table.status),
    ]
);

export const messageTaskLabelsTable = pgTable(
    'message_task_labels',
    {
        labelId: text('label_id').notNull(),
        messageId: text('message_id').notNull(),
        serverId: text('server_id').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.messageId, table.labelId] }),
        foreignKey({
            columns: [table.serverId, table.messageId],
            foreignColumns: [messageTasksTable.serverId, messageTasksTable.messageId],
            name: 'message_task_labels_task_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.labelId],
            foreignColumns: [taskLabelsTable.serverId, taskLabelsTable.id],
            name: 'message_task_labels_label_fk',
        }).onDelete('cascade'),
    ]
);
