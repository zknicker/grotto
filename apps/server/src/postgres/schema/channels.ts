import { pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { serversTable } from './servers.ts';
import { usersTable } from './users.ts';

/** A named multi-participant Chat owned by one Grotto server, such as `#all`. */
export const channelsTable = pgTable(
    'channels',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
    },
    (table) => [uniqueIndex('channels_server_name_key').on(table.serverId, table.name)]
);

/** Participation of one human in one Channel. */
export const channelParticipantsTable = pgTable(
    'channel_participants',
    {
        channelId: text('channel_id')
            .notNull()
            .references(() => channelsTable.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        userId: text('user_id')
            .notNull()
            .references(() => usersTable.id, { onDelete: 'cascade' }),
    },
    (table) => [primaryKey({ columns: [table.channelId, table.userId] })]
);
