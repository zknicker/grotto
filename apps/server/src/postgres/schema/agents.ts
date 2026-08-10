import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { avatarsTable } from './avatars.ts';
import { bunJsonb } from './bun-jsonb.ts';
import { computersTable } from './computers.ts';
import { serversTable } from './servers.ts';

/**
 * Hosted Agent identity plus Server-owned desired execution configuration and
 * the Computer's last-reported effective state. Desired config survives Computer
 * downtime; effective state is what the assigned Computer actually resolved.
 */
export const agentsTable = pgTable(
    'agents',
    {
        avatarId: text('avatar_id').references(() => avatarsTable.id, { onDelete: 'set null' }),
        computerId: text('computer_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        createdByUserId: text('created_by_user_id'),
        desiredModelId: text('desired_model_id'),
        desiredRuntimeId: text('desired_runtime_id'),
        description: text('description'),
        displayName: text('display_name').notNull(),
        effectiveMissing: bunJsonb('effective_missing').$type<string[]>(),
        effectiveModelId: text('effective_model_id'),
        effectiveReportedAt: timestamp('effective_reported_at', { withTimezone: true }),
        effectiveRuntimeId: text('effective_runtime_id'),
        factoryAppliedAt: timestamp('factory_applied_at', { withTimezone: true }),
        factoryKind: text('factory_kind')
            .notNull()
            .default('ordinary')
            .$type<'cove' | 'ordinary'>(),
        handle: text('handle').notNull(),
        homeTimezone: text('home_timezone').notNull(),
        id: text('id').primaryKey(),
        retiredAt: timestamp('retired_at', { withTimezone: true }),
        role: text('role').notNull().$type<'admin' | 'member'>(),
        sessionGeneration: integer('session_generation').notNull().default(1),
        sessionResetKind: text('session_reset_kind')
            .notNull()
            .default('session')
            .$type<'full' | 'session'>(),
        serverId: text('server_id')
            .notNull()
            .references(() => serversTable.id, { onDelete: 'cascade' }),
    },
    (table) => [
        unique('agents_server_id_key').on(table.serverId, table.id),
        uniqueIndex('agents_server_handle_key')
            .on(table.serverId, sql`lower(${table.handle})`)
            .where(sql`${table.retiredAt} is null`),
        foreignKey({
            columns: [table.serverId, table.computerId],
            foreignColumns: [computersTable.serverId, computersTable.id],
            name: 'agents_computer_fk',
        }),
        check('agents_role', sql`${table.role} in ('admin', 'member')`),
        check('agents_factory_kind', sql`${table.factoryKind} in ('ordinary', 'cove')`),
        check('agents_positive_session_generation', sql`${table.sessionGeneration} > 0`),
        check('agents_session_reset_kind', sql`${table.sessionResetKind} in ('full', 'session')`),
        check(
            'agents_description_length',
            sql`${table.description} is null or char_length(${table.description}) between 1 and 500`
        ),
        check(
            'agents_configuration',
            sql`(
                (${table.computerId} is null and ${table.desiredRuntimeId} is null and ${table.desiredModelId} is null)
                or (${table.computerId} is not null and ${table.desiredRuntimeId} is not null and ${table.desiredModelId} is not null)
            )`
        ),
    ]
);
