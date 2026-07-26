import { GrottoRestoreRefusal, runGrottoRestore } from './grotto-restore.ts';

try {
    required('RESTIC_PASSWORD_FILE');
    required('RESTIC_REPOSITORY');
    await runGrottoRestore({
        attachmentRoot: required('GROTTO_ATTACHMENT_ROOT'),
        pgRestoreCommand:
            process.env.GROTTO_PG_RESTORE_COMMAND ??
            '/opt/homebrew/opt/postgresql@16/bin/pg_restore',
        productionDatabaseUrl: required('GROTTO_PRODUCTION_DATABASE_URL'),
        resticCommand: process.env.GROTTO_RESTIC_COMMAND ?? '/opt/homebrew/bin/restic',
        restoreDatabaseUrl: required('GROTTO_RESTORE_DATABASE_URL'),
        snapshot: required('GROTTO_RESTORE_SNAPSHOT'),
        targetRoot: required('GROTTO_RESTORE_TARGET_ROOT'),
    });
    console.log(JSON.stringify({ status: 'ok' }));
} catch (error) {
    const refused = error instanceof GrottoRestoreRefusal;
    console.error(
        JSON.stringify({
            code: refused ? 'restore_target_refused' : 'restore_failed',
            status: 'error',
        })
    );
    process.exit(1);
}

function required(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required.`);
    }
    return value;
}
