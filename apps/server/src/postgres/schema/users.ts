import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { avatarsTable } from './avatars.ts';

/**
 * Grotto owns the human identity. `clerk_user_id` is only a unique external
 * reference to the authenticating Clerk user; Clerk Organizations and Clerk
 * roles never appear here because they carry no Grotto authority.
 */
export const usersTable = pgTable(
    'users',
    {
        avatarId: text('avatar_id').references(() => avatarsTable.id, { onDelete: 'set null' }),
        clerkUserId: text('clerk_user_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        description: text('description'),
        // Seeded from the caller's Clerk identity on first sign-in, then owned
        // by the human. Null until they have opened the App.
        displayName: text('display_name'),
        email: text('email'),
        id: text('id').primaryKey(),
    },
    (table) => [uniqueIndex('users_clerk_user_id_key').on(table.clerkUserId)]
);
