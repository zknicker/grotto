import { customType } from 'drizzle-orm/pg-core';

/**
 * Bun SQL accepts structured JSON values directly. Drizzle's stock PostgreSQL
 * JSONB column stringifies first, which Bun SQL then encodes as a JSON string.
 */
export const bunJsonb = customType<{ data: unknown; driverData: unknown }>({
    dataType: () => 'jsonb',
});
