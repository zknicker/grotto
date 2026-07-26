import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { serversTable } from './servers.ts';
import { usersTable } from './users.ts';

/** Standing access of one human to one Grotto server, with their Server role. */
export const serverMembershipsTable = pgTable(
    'server_memberships',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        role: text('role').notNull().$type<'admin' | 'member' | 'owner'>(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
        userId: text('user_id')
            .notNull()
            .references(() => usersTable.id, { onDelete: 'cascade' }),
    },
    (table) => [
        uniqueIndex('server_memberships_server_user_key').on(table.serverId, table.userId),
        index('server_memberships_user_idx').on(table.userId),
    ]
);
