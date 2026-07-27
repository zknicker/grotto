import { cp, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
    copyEnvironmentWithout,
    postgresEnvironment,
    runGrottoCommand,
    sha256,
} from './grotto-operations.ts';

export interface GrottoBackupOptions {
    attachmentRoot: string;
    databaseUrl: string;
    pgDumpCommand: string;
    resticCommand: string;
    stagingRoot: string;
    successFile: string;
}

export async function runGrottoBackup(options: GrottoBackupOptions) {
    await mkdir(options.stagingRoot, { recursive: true });
    const snapshotRoot = await mkdtemp(join(options.stagingRoot, 'snapshot-'));
    const databaseDump = join(snapshotRoot, 'database.dump');
    const stagedAttachments = join(snapshotRoot, 'attachments');

    try {
        await runGrottoCommand(options.pgDumpCommand, ['--format=custom', '--file', databaseDump], {
            env: {
                ...copyEnvironmentWithout(
                    'AWS_ACCESS_KEY_ID',
                    'AWS_SECRET_ACCESS_KEY',
                    'AWS_SESSION_TOKEN',
                    'GROTTO_DATABASE_URL',
                    'RESTIC_PASSWORD_FILE',
                    'RESTIC_REPOSITORY'
                ),
                ...postgresEnvironment(options.databaseUrl),
            },
        });
        await cp(options.attachmentRoot, stagedAttachments, { recursive: true });

        const sentinel = join(stagedAttachments, '.backup-sentinel');
        const manifest = {
            attachmentSentinelSha256: await sha256(sentinel),
            createdAt: new Date().toISOString(),
            databaseSha256: await sha256(databaseDump),
        };
        await writeFile(join(snapshotRoot, 'manifest.json'), `${JSON.stringify(manifest)}\n`, {
            mode: 0o600,
        });

        await runGrottoCommand(options.resticCommand, ['backup', '.', '--tag', 'grotto.sh'], {
            cwd: snapshotRoot,
            env: copyEnvironmentWithout('GROTTO_DATABASE_URL', 'PGPASSWORD'),
            redact: [process.env.RESTIC_REPOSITORY ?? ''],
        });
        await runGrottoCommand(
            options.resticCommand,
            [
                'forget',
                '--keep-last',
                '28',
                '--keep-daily',
                '14',
                '--keep-weekly',
                '8',
                '--keep-monthly',
                '12',
                '--prune',
            ],
            {
                env: copyEnvironmentWithout('GROTTO_DATABASE_URL', 'PGPASSWORD'),
                redact: [process.env.RESTIC_REPOSITORY ?? ''],
            }
        );

        await recordSuccess(options.successFile, manifest.createdAt);
    } finally {
        await rm(snapshotRoot, { force: true, recursive: true });
    }
}

async function recordSuccess(path: string, timestamp: string) {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, `${timestamp}\n`, { mode: 0o600 });
    await rename(temporaryPath, path);
}
