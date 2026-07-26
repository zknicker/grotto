/**
 * A `DATABASE_URL` carries a password. Everything that names the database in a
 * log line, an error, or a diagnostic goes through here first.
 */
export function describeDatabaseUrl(databaseUrl: string): string {
    try {
        const url = new URL(databaseUrl);

        url.password = '';
        url.username = '';
        return url.toString();
    } catch {
        return 'the configured PostgreSQL database';
    }
}
