import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Grotto owns the human identity. `clerk_user_id` is only a unique external
 * reference to the authenticating Clerk user; Clerk Organizations and Clerk
 * roles never appear here because they carry no Grotto authority.
 */
export const usersTable = pgTable(
    'users',
    {
        clerkUserId: text('clerk_user_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
    },
    (table) => [uniqueIndex('users_clerk_user_id_key').on(table.clerkUserId)]
);
