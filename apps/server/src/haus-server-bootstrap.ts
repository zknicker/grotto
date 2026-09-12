import { bootstrapHausDatabase } from './postgres/bootstrap.ts';

const databaseUrl = process.env.HAUS_DATABASE_BOOTSTRAP_URL;
const backupRole = process.env.HAUS_DATABASE_BACKUP_ROLE;
const runtimeRole = process.env.HAUS_DATABASE_RUNTIME_ROLE;

if (!(databaseUrl && backupRole && runtimeRole)) {
    console.error(
        'HAUS_DATABASE_BOOTSTRAP_URL, HAUS_DATABASE_BACKUP_ROLE, and HAUS_DATABASE_RUNTIME_ROLE are required.'
    );
    process.exit(1);
}

try {
    await bootstrapHausDatabase(databaseUrl, runtimeRole, backupRole);
    console.log(`Fresh Haus PostgreSQL schema ready for ${runtimeRole}.`);
} catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown PostgreSQL error.';
    console.error(`Fresh Haus PostgreSQL bootstrap failed: ${reason}`);
    process.exit(1);
}
