import { SQL } from 'bun';
import { migrateGrottoDatabase } from './migrations.ts';
import { assertGrottoDatabaseRole, grantGrottoRuntimePrivileges } from './roles.ts';

/**
 * Creates a fresh hosted Grotto Server database from checked-in Drizzle
 * migrations. Schema changes never live in this bootstrap wrapper.
 */
export async function bootstrapGrottoDatabase(
    databaseUrl: string,
    runtimeRole: string,
    backupRole = runtimeRole
) {
    assertGrottoDatabaseRole(runtimeRole, 'runtime');
    assertGrottoDatabaseRole(backupRole, 'backup');

    const client = new SQL({ max: 1, url: databaseUrl });
    try {
        const existingTables = (await client`
            SELECT count(*)::int AS total
            FROM information_schema.tables
            WHERE table_schema = 'public'
        `) as { total: number }[];
        if (existingTables[0]?.total !== 0) {
            throw new Error('The Grotto PostgreSQL database must be empty before bootstrap.');
        }

        await client.unsafe('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
        await grantGrottoRuntimePrivileges(client, runtimeRole);
    } finally {
        await client.close();
    }

    await migrateGrottoDatabase(databaseUrl, runtimeRole, backupRole);
}
