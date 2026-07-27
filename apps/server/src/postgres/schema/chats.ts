import { sql } from 'drizzle-orm';
import {
    boolean,
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
import { serverMembershipsTable } from './server-memberships.ts';
import { serversTable } from './servers.ts';

export const chatsTable = pgTable(
    'chats',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        dmMemberOneUserId: text('dm_member_one_user_id'),
        dmMemberTwoUserId: text('dm_member_two_user_id'),
        id: text('id').primaryKey(),
        isAll: boolean('is_all').notNull().default(false),
        kind: text('kind').notNull().$type<'channel' | 'dm' | 'thread'>(),
        lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
        lastMessageSequence: integer('last_message_sequence').notNull().default(0),
        lastTaskNumber: integer('last_task_number').notNull().default(0),
        name: text('name'),
        anchorMessageId: text('anchor_message_id'),
        parentChatId: text('parent_chat_id'),
        parentChatKind: text('parent_chat_kind').$type<'channel' | 'dm'>(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
    },
    (table) => [
        uniqueIndex('chats_server_id_key').on(table.serverId, table.id),
        uniqueIndex('chats_server_id_kind_key').on(table.serverId, table.id, table.kind),
        uniqueIndex('chats_server_channel_name_key')
            .on(table.serverId, table.name)
            .where(sql`${table.kind} = 'channel'`),
        uniqueIndex('chats_server_dm_pair_key')
            .on(table.serverId, table.dmMemberOneUserId, table.dmMemberTwoUserId)
            .where(sql`${table.kind} = 'dm'`),
        uniqueIndex('chats_server_all_key').on(table.serverId).where(sql`${table.isAll} = true`),
        uniqueIndex('chats_server_thread_anchor_key')
            .on(table.serverId, table.parentChatId, table.anchorMessageId)
            .where(sql`${table.kind} = 'thread'`),
        foreignKey({
            columns: [table.serverId, table.dmMemberOneUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'chats_dm_member_one_membership_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.dmMemberTwoUserId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'chats_dm_member_two_membership_fk',
        }),
        foreignKey({
            columns: [table.serverId, table.parentChatId, table.parentChatKind],
            foreignColumns: [table.serverId, table.id, table.kind],
            name: 'chats_thread_parent_fk',
        }),
        check('chats_nonnegative_sequence', sql`${table.lastMessageSequence} >= 0`),
        check('chats_nonnegative_task_number', sql`${table.lastTaskNumber} >= 0`),
        check('chats_kind', sql`${table.kind} in ('channel', 'dm', 'thread')`),
        check(
            'chats_shape',
            sql`(
                (
                    ${table.kind} = 'channel'
                    and ${table.name} is not null
                    and ${table.dmMemberOneUserId} is null
                    and ${table.dmMemberTwoUserId} is null
                    and ${table.parentChatId} is null
                    and ${table.parentChatKind} is null
                    and ${table.anchorMessageId} is null
                    and (not ${table.isAll} or ${table.name} = 'all')
                )
                or (
                    ${table.kind} = 'dm'
                    and ${table.name} is null
                    and ${table.isAll} = false
                    and ${table.dmMemberOneUserId} is not null
                    and ${table.dmMemberTwoUserId} is not null
                    and ${table.parentChatId} is null
                    and ${table.parentChatKind} is null
                    and ${table.anchorMessageId} is null
                    and ${table.dmMemberOneUserId} < ${table.dmMemberTwoUserId}
                )
                or (
                    ${table.kind} = 'thread'
                    and ${table.name} is null
                    and ${table.isAll} = false
                    and ${table.dmMemberOneUserId} is null
                    and ${table.dmMemberTwoUserId} is null
                    and ${table.parentChatId} is not null
                    and ${table.parentChatKind} in ('channel', 'dm')
                    and ${table.anchorMessageId} is not null
                )
            )`
        ),
    ]
);

export const channelParticipantsTable = pgTable(
    'channel_participants',
    {
        chatId: text('chat_id').notNull(),
        chatKind: text('chat_kind').notNull().default('channel'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        serverId: text('server_id').notNull(),
        userId: text('user_id').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.chatId, table.userId] }),
        foreignKey({
            columns: [table.serverId, table.chatId, table.chatKind],
            foreignColumns: [chatsTable.serverId, chatsTable.id, chatsTable.kind],
            name: 'channel_participants_chat_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.userId],
            foreignColumns: [serverMembershipsTable.serverId, serverMembershipsTable.userId],
            name: 'channel_participants_membership_fk',
        }).onDelete('cascade'),
        index('channel_participants_user_idx').on(table.serverId, table.userId),
        check('channel_participants_kind', sql`${table.chatKind} = 'channel'`),
    ]
);
