import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export type ComputerLoginGrantStatus = 'approved' | 'consumed' | 'denied' | 'expired' | 'pending';

export const computerLoginGrantsTable = pgTable(
    'computer_login_grants',
    {
        approvedAt: timestamp('approved_at', { withTimezone: true }),
        approvedByClerkUserId: text('approved_by_clerk_user_id'),
        consumedAt: timestamp('consumed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        deviceCodeHash: text('device_code_hash').notNull(),
        deniedAt: timestamp('denied_at', { withTimezone: true }),
        deniedByClerkUserId: text('denied_by_clerk_user_id'),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        id: text('id').primaryKey(),
        origin: text('origin').notNull(),
        pollingIntervalMs: integer('polling_interval_ms').notNull(),
        status: text('status').notNull().$type<ComputerLoginGrantStatus>(),
        userCodeHash: text('user_code_hash').notNull(),
    },
    (table) => [
        uniqueIndex('computer_login_grants_device_code_hash_key').on(table.deviceCodeHash),
        uniqueIndex('computer_login_grants_user_code_hash_key').on(table.userCodeHash),
        index('computer_login_grants_expiry_idx').on(table.expiresAt, table.status),
        check('computer_login_grants_id_shape', sql`${table.id} ~ '^dgr_[A-Za-z0-9_-]{16}$'`),
        check(
            'computer_login_grants_device_code_hash_shape',
            sql`${table.deviceCodeHash} ~ '^[a-f0-9]{64}$'`
        ),
        check(
            'computer_login_grants_user_code_hash_shape',
            sql`${table.userCodeHash} ~ '^[a-f0-9]{64}$'`
        ),
        check(
            'computer_login_grants_polling_interval_positive',
            sql`${table.pollingIntervalMs} > 0`
        ),
        check(
            'computer_login_grants_status',
            sql`${table.status} in ('pending', 'approved', 'denied', 'expired', 'consumed')`
        ),
    ]
);

export const computerLoginSessionsTable = pgTable(
    'computer_login_sessions',
    {
        accessTokenExpiresAt: timestamp('access_token_expires_at', {
            withTimezone: true,
        }).notNull(),
        accessTokenHash: text('access_token_hash').notNull(),
        clerkUserId: text('clerk_user_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        grantId: text('grant_id')
            .notNull()
            .references(() => computerLoginGrantsTable.id, { onDelete: 'cascade' }),
        id: text('id').primaryKey(),
        origin: text('origin').notNull(),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
            withTimezone: true,
        }).notNull(),
        refreshTokenHash: text('refresh_token_hash').notNull(),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        storedAt: timestamp('stored_at', { withTimezone: true }),
    },
    (table) => [
        uniqueIndex('computer_login_sessions_grant_key').on(table.grantId),
        uniqueIndex('computer_login_sessions_access_token_hash_key').on(table.accessTokenHash),
        uniqueIndex('computer_login_sessions_refresh_token_hash_key').on(table.refreshTokenHash),
        index('computer_login_sessions_owner_idx').on(table.clerkUserId, table.createdAt),
        check('computer_login_sessions_id_shape', sql`${table.id} ~ '^cls_[A-Za-z0-9_-]{16}$'`),
        check(
            'computer_login_sessions_access_token_hash_shape',
            sql`${table.accessTokenHash} ~ '^[a-f0-9]{64}$'`
        ),
        check(
            'computer_login_sessions_refresh_token_hash_shape',
            sql`${table.refreshTokenHash} ~ '^[a-f0-9]{64}$'`
        ),
    ]
);

export const computerLoginRefreshTokensTable = pgTable(
    'computer_login_refresh_tokens',
    {
        consumedAt: timestamp('consumed_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        id: text('id').primaryKey(),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        sessionId: text('session_id')
            .notNull()
            .references(() => computerLoginSessionsTable.id, { onDelete: 'cascade' }),
        tokenHash: text('token_hash').notNull(),
    },
    (table) => [
        uniqueIndex('computer_login_refresh_tokens_token_hash_key').on(table.tokenHash),
        index('computer_login_refresh_tokens_session_idx').on(table.sessionId, table.createdAt),
        check(
            'computer_login_refresh_tokens_id_shape',
            sql`${table.id} ~ '^crt_[A-Za-z0-9_-]{16}$'`
        ),
        check(
            'computer_login_refresh_tokens_token_hash_shape',
            sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`
        ),
    ]
);
