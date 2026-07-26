import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * A Grotto server: an opaque id every relationship points at, a globally
 * unique immutable slug used only as the human-facing address, and an
 * editable display name.
 */
export const serversTable = pgTable(
    'servers',
    {
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        displayName: text('display_name').notNull(),
        id: text('id').primaryKey(),
        lastChatEventCursor: bigint('last_chat_event_cursor', { mode: 'bigint' })
            .notNull()
            .default(0n),
        slug: text('slug').notNull(),
    },
    (table) => [
        uniqueIndex('servers_slug_key').on(table.slug),
        check('servers_nonnegative_chat_event_cursor', sql`${table.lastChatEventCursor} >= 0`),
    ]
);
