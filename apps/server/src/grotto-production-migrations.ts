import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const productionMigrationConfig = '/Users/zknicker/srv/grotto/config/migration.env';
const regularFileType = 0o10_0000;
const fileTypeMask = 0o17_0000;

export async function migrateProductionDatabase(
    releaseRoot: string,
    options: {
        execute?: (binary: string, env: Record<string, string>) => void;
        exists?: (path: string) => Promise<boolean>;
        inspect?: (path: string) => Promise<{ mode: number; uid: number }>;
        readConfig?: (path: string) => Promise<string>;
    } = {}
) {
    const binary = join(releaseRoot, 'bin', 'grotto-server-migrate');
    const migrationsFolder = join(releaseRoot, 'share', 'grotto-server', 'migrations');
    const exists = options.exists ?? pathExists;
    const [hasBinary, hasMigrations] = await Promise.all([
        exists(binary),
        exists(migrationsFolder),
    ]);
    if (!(hasBinary || hasMigrations)) {
        return;
    }
    if (!(hasBinary && hasMigrations)) {
        throw new Error('Grotto release has an incomplete PostgreSQL migration bundle.');
    }

    const stat = await (options.inspect ?? lstat)(productionMigrationConfig);
    if (
        stat.uid !== 0 ||
        (stat.mode & 0o077) !== 0 ||
        (stat.mode & fileTypeMask) !== regularFileType
    ) {
        throw new Error('migration.env must be a root-owned mode 0600 regular file.');
    }
    const config = await (options.readConfig ?? readTextFile)(productionMigrationConfig);
    const { backupRole, databaseUrl, runtimeRole } = readMigrationConfig(config);

    (options.execute ?? executeMigration)(binary, {
        GROTTO_DATABASE_BACKUP_ROLE: backupRole,
        GROTTO_DATABASE_MIGRATION_URL: databaseUrl,
        GROTTO_DATABASE_RUNTIME_ROLE: runtimeRole,
        GROTTO_MIGRATIONS_FOLDER: migrationsFolder,
    });
}

export function readMigrationConfig(config: string) {
    const values = config
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.match(/^([A-Z_]+)=(.+)$/u)?.slice(1))
        .filter((value): value is [string, string] => Boolean(value));
    const entries = Object.fromEntries(values);

    if (
        values.length !== 3 ||
        !entries.GROTTO_DATABASE_BACKUP_ROLE ||
        !entries.GROTTO_DATABASE_MIGRATION_URL ||
        !entries.GROTTO_DATABASE_RUNTIME_ROLE
    ) {
        throw new Error(
            'migration.env must define the migration URL, runtime role, and backup role exactly once.'
        );
    }
    return {
        backupRole: entries.GROTTO_DATABASE_BACKUP_ROLE,
        databaseUrl: entries.GROTTO_DATABASE_MIGRATION_URL,
        runtimeRole: entries.GROTTO_DATABASE_RUNTIME_ROLE,
    };
}

function readTextFile(path: string) {
    return readFile(path, 'utf8');
}

async function pathExists(path: string) {
    try {
        await lstat(path);
        return true;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

function executeMigration(binary: string, env: Record<string, string>) {
    const result = Bun.spawnSync([binary], {
        env,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    if (result.exitCode !== 0) {
        throw new Error(`Grotto PostgreSQL migration failed with exit code ${result.exitCode}.`);
    }
}
