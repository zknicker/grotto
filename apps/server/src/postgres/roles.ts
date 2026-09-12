import type { SQL } from 'bun';

export async function grantHausRuntimePrivileges(client: SQL, runtimeRole: string) {
    assertHausDatabaseRole(runtimeRole, 'runtime');
    await client.unsafe(`GRANT USAGE ON SCHEMA public TO ${runtimeRole}`);
    await client.unsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`
    );
    await client.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole}`);
    await client.unsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole}`
    );
    await client.unsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT USAGE, SELECT ON SEQUENCES TO ${runtimeRole}`
    );
}

export async function grantHausBackupPrivileges(client: SQL, backupRole: string) {
    assertHausDatabaseRole(backupRole, 'backup');
    await client.unsafe(`GRANT USAGE ON SCHEMA public, drizzle TO ${backupRole}`);
    await client.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO ${backupRole}`);
    await client.unsafe(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO ${backupRole}`);
    await client.unsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${backupRole}`
    );
    await client.unsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${backupRole}`
    );
}

export function assertHausDatabaseRole(role: string, kind: 'backup' | 'runtime') {
    if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(role)) {
        throw new Error(`The Haus PostgreSQL ${kind} role must be a plain PostgreSQL identifier.`);
    }
}
