import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SQL } from 'bun';
import {
    copyEnvironmentWithout,
    postgresEnvironment,
    runGrottoCommand,
    sha256,
} from './grotto-operations.ts';

export interface GrottoRestoreOptions {
    attachmentRoot: string;
    pgRestoreCommand: string;
    productionDatabaseUrl: string;
    resticCommand: string;
    restoreDatabaseUrl: string;
    snapshot: string;
    targetRoot: string;
}

export class GrottoRestoreRefusal extends Error {}

export async function runGrottoRestore(options: GrottoRestoreOptions) {
    await refuseProductionTargets(options);
    await ensureEmptyDatabase(options.restoreDatabaseUrl);
    await runGrottoCommand(
        options.resticCommand,
        ['restore', options.snapshot, '--target', options.targetRoot],
        {
            env: copyEnvironmentWithout(
                'GROTTO_PRODUCTION_DATABASE_URL',
                'GROTTO_RESTORE_DATABASE_URL',
                'PGPASSWORD'
            ),
            redact: [process.env.RESTIC_REPOSITORY ?? ''],
        }
    );
    await verifySnapshot(options.targetRoot);

    const database = postgresEnvironment(options.restoreDatabaseUrl);
    await runGrottoCommand(
        options.pgRestoreCommand,
        [
            '--exit-on-error',
            '--no-owner',
            '--no-privileges',
            '--dbname',
            database.PGDATABASE,
            `${options.targetRoot}/database.dump`,
        ],
        {
            env: {
                ...copyEnvironmentWithout(
                    'AWS_ACCESS_KEY_ID',
                    'AWS_SECRET_ACCESS_KEY',
                    'AWS_SESSION_TOKEN',
                    'GROTTO_PRODUCTION_DATABASE_URL',
                    'GROTTO_RESTORE_DATABASE_URL',
                    'RESTIC_PASSWORD_FILE',
                    'RESTIC_REPOSITORY'
                ),
                ...database,
            },
        }
    );
}

async function refuseProductionTargets(options: GrottoRestoreOptions) {
    if (
        databaseTarget(options.productionDatabaseUrl) === databaseTarget(options.restoreDatabaseUrl)
    ) {
        throw new GrottoRestoreRefusal('Restore database must be isolated from production.');
    }

    const productionAttachments = resolve(options.attachmentRoot);
    const restoreRoot = resolve(options.targetRoot);
    if (
        productionAttachments === restoreRoot ||
        productionAttachments.startsWith(`${restoreRoot}/`) ||
        restoreRoot.startsWith(`${productionAttachments}/`)
    ) {
        throw new GrottoRestoreRefusal(
            'Restore files must be isolated from production attachments.'
        );
    }

    try {
        await lstat(restoreRoot);
        throw new GrottoRestoreRefusal('Restore target root must not already exist.');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }
}

async function ensureEmptyDatabase(databaseUrl: string) {
    const client = new SQL(databaseUrl);

    try {
        const rows = (await client`
            SELECT count(*)::int AS total
            FROM information_schema.tables
            WHERE table_schema = 'public'
        `) as { total: number }[];

        if (rows[0]?.total !== 0) {
            throw new GrottoRestoreRefusal('Restore database must be empty.');
        }
    } finally {
        await client.close();
    }
}

async function verifySnapshot(targetRoot: string) {
    const manifest = JSON.parse(await readFile(`${targetRoot}/manifest.json`, 'utf8')) as {
        attachmentSentinelSha256?: string;
        databaseSha256?: string;
    };
    const databaseSha256 = await sha256(`${targetRoot}/database.dump`);
    const sentinelSha256 = await sha256(`${targetRoot}/attachments/.backup-sentinel`);

    if (
        manifest.databaseSha256 !== databaseSha256 ||
        manifest.attachmentSentinelSha256 !== sentinelSha256
    ) {
        throw new Error('Restored backup checksum verification failed.');
    }
}

function databaseTarget(databaseUrl: string) {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1))}`;
}
