import type { AvatarMediaType } from '@tavern/api/avatar';
import { sql } from 'drizzle-orm';
import { check, customType, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Bun SQL encodes and decodes `bytea` as raw bytes. Drizzle has no stock
 * PostgreSQL binary column, so the driver's own representation passes through.
 */
const bunBytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
    dataType: () => 'bytea',
});

/**
 * One uploaded square avatar, owned by exactly one Agent or human through
 * their `avatar_id`. Avatars are small and immutable — replacing one writes a
 * fresh row and drops the old one — so the bytes live here rather than in the
 * attachment object store.
 */
export const avatarsTable = pgTable(
    'avatars',
    {
        byteSize: integer('byte_size').notNull(),
        bytes: bunBytea('bytes').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        id: text('id').primaryKey(),
        mediaType: text('media_type').notNull().$type<AvatarMediaType>(),
        sha256: text('sha256').notNull(),
    },
    (table) => [
        check('avatars_id_shape', sql`${table.id} ~ '^avt_[a-z0-9]{16}$'`),
        check(
            'avatars_media_type',
            sql`${table.mediaType} in ('image/jpeg', 'image/png', 'image/webp')`
        ),
        check('avatars_size', sql`${table.byteSize} > 0 and ${table.byteSize} <= 2097152`),
        check('avatars_sha256', sql`${table.sha256} ~ '^[a-f0-9]{64}$'`),
    ]
);
