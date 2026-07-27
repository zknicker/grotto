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
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { chatsTable } from './chats.ts';
import { serverMembershipsTable } from './server-memberships.ts';

const tsvector = customType<{ data: string }>({
    dataType: () => 'tsvector',
});

export const chatMessagesTable = pgTable(
    'chat_messages',
    {
        authorUserId: text('author_user_id').notNull(),
        chatId: text('chat_id').notNull(),
        content: text('content').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        nonce: text('nonce').notNull(),
        searchVector: tsvector('search_vector').generatedAlwaysAs(
            sql`to_tsvector('simple', content)`
        ),
        sequence: integer('sequence').notNull(),
        serverId: text('server_id').notNull(),
    },
    (table) => [
        uniqueIndex('chat_messages_server_id_key').on(table.serverId, table.id),
        uniqueIndex('chat_messages_server_chat_id_key').on(table.serverId, table.chatId, table.id),
        uniqueIndex('chat_messages_chat_sequence_key').on(
            table.serverId,
            table.chatId,
            table.sequence
        ),
        uniqueIndex('chat_messages_chat_nonce_key').on(table.serverId, table.chatId, table.nonce),
        foreignKey({
            columns: [table.serverId, table.chatId],
            foreignColumns: [chatsTable.serverId, chatsTable.id],
            name: 'chat_messages_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.authorUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'chat_messages_author_membership_fk',
        }),
        check('chat_messages_positive_sequence', sql`${table.sequence} > 0`),
        index('chat_messages_chat_sequence_idx').on(table.serverId, table.chatId, table.sequence),
        index('chat_messages_search_idx').using('gin', table.searchVector),
    ]
);
