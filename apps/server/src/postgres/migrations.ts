import { basename, dirname, join, resolve } from 'node:path';
import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import {
    assertGrottoDatabaseRole,
    grantGrottoBackupPrivileges,
    grantGrottoRuntimePrivileges,
} from './roles.ts';

const packagedMigrationsFolder = join(
    dirname(process.execPath),
    '..',
    'share',
    'grotto-server',
    'migrations'
);

export function resolveGrottoMigrationsFolder(folder = process.env.GROTTO_MIGRATIONS_FOLDER) {
    if (folder) {
        return resolve(folder);
    }
    if (basename(process.execPath).startsWith('grotto-server-')) {
        return resolve(packagedMigrationsFolder);
    }
    return resolve(import.meta.dir, '..', '..', 'drizzle', 'postgres');
}

export async function migrateGrottoDatabase(
    databaseUrl: string,
    runtimeRole: string,
    backupRole: string,
    migrationsFolder?: string
) {
    const client = new SQL({ max: 1, url: databaseUrl });

    try {
        assertGrottoDatabaseRole(runtimeRole, 'runtime');
        assertGrottoDatabaseRole(backupRole, 'backup');
        await grantGrottoRuntimePrivileges(client, runtimeRole);
        await migrate(drizzle(client), {
            migrationsFolder: resolveGrottoMigrationsFolder(migrationsFolder),
        });
        await grantGrottoRuntimePrivileges(client, runtimeRole);
        await grantGrottoBackupPrivileges(client, backupRole);
    } finally {
        await client.close();
    }
}
