import { readFile } from 'node:fs/promises';
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
    const folder = resolveGrottoMigrationsFolder(migrationsFolder);

    try {
        assertGrottoDatabaseRole(runtimeRole, 'runtime');
        assertGrottoDatabaseRole(backupRole, 'backup');
        const latestMigrationTime = await readLatestMigrationTime(client);
        await grantGrottoRuntimePrivileges(client, runtimeRole);
        await migrate(drizzle(client), {
            migrationsFolder: folder,
        });
        await grantGrottoRuntimePrivileges(client, runtimeRole);
        await grantGrottoBackupPrivileges(client, backupRole);
        return await readAppliedMigrationTags(folder, latestMigrationTime);
    } finally {
        await client.close();
    }
}

async function readLatestMigrationTime(client: SQL) {
    const [table] = (await client`
        SELECT to_regclass('drizzle.__drizzle_migrations')::text AS name
    `) as { name: string | null }[];
    if (!table?.name) {
        return Number.NEGATIVE_INFINITY;
    }
    const [migration] = (await client`
        SELECT created_at::text AS created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at DESC
        LIMIT 1
    `) as { created_at: string }[];
    return migration ? Number(migration.created_at) : Number.NEGATIVE_INFINITY;
}

async function readAppliedMigrationTags(folder: string, latestMigrationTime: number) {
    const journal = JSON.parse(await readFile(join(folder, 'meta', '_journal.json'), 'utf8')) as {
        entries: { tag: string; when: number }[];
    };
    return journal.entries
        .filter((entry) => entry.when > latestMigrationTime)
        .map((entry) => entry.tag);
}
