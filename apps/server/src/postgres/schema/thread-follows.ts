import { boolean, foreignKey, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { chatsTable } from './chats.ts';
import { serverMembershipsTable } from './server-memberships.ts';

export const threadFollowsTable = pgTable(
    'thread_follows',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        followed: boolean('followed').notNull().default(true),
        serverId: text('server_id').notNull(),
        threadChatId: text('thread_chat_id').notNull(),
        threadChatKind: text('thread_chat_kind').notNull().default('thread'),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        userId: text('user_id').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.threadChatId, table.userId] }),
        foreignKey({
            columns: [table.serverId, table.threadChatId, table.threadChatKind],
            foreignColumns: [chatsTable.serverId, chatsTable.id, chatsTable.kind],
            name: 'thread_follows_thread_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.userId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'thread_follows_membership_fk',
        }).onDelete('cascade'),
    ]
);
