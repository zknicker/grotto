import { runGrottoBackup } from './grotto-backup.ts';

try {
    required('RESTIC_PASSWORD_FILE');
    required('RESTIC_REPOSITORY');
    await runGrottoBackup({
        attachmentRoot: required('GROTTO_ATTACHMENT_ROOT'),
        databaseUrl: required('GROTTO_DATABASE_URL'),
        pgDumpCommand:
            process.env.GROTTO_PG_DUMP_COMMAND ?? '/opt/homebrew/opt/postgresql@16/bin/pg_dump',
        resticCommand: process.env.GROTTO_RESTIC_COMMAND ?? '/opt/homebrew/bin/restic',
        stagingRoot: required('GROTTO_BACKUP_STAGING_ROOT'),
        successFile: required('GROTTO_BACKUP_SUCCESS_FILE'),
    });
    console.log(JSON.stringify({ status: 'ok' }));
} catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown backup error.';
    console.error(JSON.stringify({ code: 'backup_failed', reason, status: 'error' }));
    process.exit(1);
}

function required(name: string) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is required.`);
    }

    return value;
}
