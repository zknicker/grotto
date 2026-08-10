import { migrateGrottoDatabase } from './postgres/migrations.ts';

const databaseUrl = process.env.GROTTO_DATABASE_MIGRATION_URL;
const backupRole = process.env.GROTTO_DATABASE_BACKUP_ROLE;
const runtimeRole = process.env.GROTTO_DATABASE_RUNTIME_ROLE;

if (!(databaseUrl && backupRole && runtimeRole)) {
    console.error(
        'GROTTO_DATABASE_MIGRATION_URL, GROTTO_DATABASE_BACKUP_ROLE, and GROTTO_DATABASE_RUNTIME_ROLE are required.'
    );
    process.exit(1);
}

try {
    await migrateGrottoDatabase(databaseUrl, runtimeRole, backupRole);
    console.log('Grotto PostgreSQL migrations are current.');
} catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown PostgreSQL error.';
    console.error(`Grotto PostgreSQL migration failed: ${reason}`);
    process.exit(1);
}
