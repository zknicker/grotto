import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { serversTable } from './servers.ts';
import { usersTable } from './users.ts';

/**
 * Standing access of one human to one Grotto server, with their Server role.
 * The row is the durable anchor every authored message, read, and DM points at,
 * so revocation sets `revokedAt` and re-acceptance resets the same row into a
 * fresh Member stint stamped with a new `joinedAt`.
 */
export const serverMembershipsTable = pgTable(
    'server_memberships',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
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
