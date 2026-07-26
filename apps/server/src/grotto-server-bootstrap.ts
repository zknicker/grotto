import { bootstrapGrottoDatabase } from './postgres/bootstrap.ts';

const databaseUrl = process.env.GROTTO_DATABASE_BOOTSTRAP_URL;
const runtimeRole = process.env.GROTTO_DATABASE_RUNTIME_ROLE;

if (!(databaseUrl && runtimeRole)) {
    console.error('GROTTO_DATABASE_BOOTSTRAP_URL and GROTTO_DATABASE_RUNTIME_ROLE are required.');
    process.exit(1);
}

try {
    await bootstrapGrottoDatabase(databaseUrl, runtimeRole);
    console.log(`Fresh Grotto PostgreSQL schema ready for ${runtimeRole}.`);
} catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown PostgreSQL error.';
    console.error(`Fresh Grotto PostgreSQL bootstrap failed: ${reason}`);
    process.exit(1);
}
