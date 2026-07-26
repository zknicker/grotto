import { SQL } from 'bun';

/**
 * Fresh-schema setup for the hosted Grotto server, mirroring the SQLite
 * bootstrap seam: this DDL is the schema of record, and `schema.ts` describes
 * the same tables for typed queries. There is no migration history.
 */
const schemaStatements = [
    `CREATE TABLE users (
        id text PRIMARY KEY NOT NULL,
        clerk_user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX users_clerk_user_id_key ON users (clerk_user_id);',
    `CREATE TABLE servers (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL,
        display_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX servers_slug_key ON servers (slug);',
    `CREATE TABLE server_memberships (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role text NOT NULL CONSTRAINT server_memberships_role
            CHECK (role IN ('owner', 'admin', 'member')),
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX server_memberships_server_user_key
        ON server_memberships (server_id, user_id);`,
    `CREATE INDEX server_memberships_user_idx
        ON server_memberships (user_id);`,
    `CREATE TABLE channels (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX channels_server_name_key
        ON channels (server_id, name);`,
    `CREATE TABLE channel_participants (
        channel_id text NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (channel_id, user_id)
    );`,
];

export async function ensureGrottoSchema(client: SQL, runtimeRole: string) {
    if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(runtimeRole)) {
        throw new Error(
            'The Grotto PostgreSQL runtime role must be a plain PostgreSQL identifier.'
        );
    }

    const existingTables = (await client`
        SELECT count(*)::int AS total
        FROM information_schema.tables
        WHERE table_schema = 'public'
    `) as { total: number }[];
    if (existingTables[0]?.total !== 0) {
        throw new Error('The Grotto PostgreSQL database must be empty before bootstrap.');
    }

    for (const statement of schemaStatements) {
        await client.unsafe(statement);
    }

    await client.unsafe('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await client.unsafe(`GRANT USAGE ON SCHEMA public TO ${runtimeRole}`);
    await client.unsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`
    );
}

export async function bootstrapGrottoDatabase(databaseUrl: string, runtimeRole: string) {
    const client = new SQL({ max: 1, url: databaseUrl });

    try {
        await client.unsafe('BEGIN');
        try {
            await ensureGrottoSchema(client, runtimeRole);
            await client.unsafe('COMMIT');
        } catch (error) {
            await client.unsafe('ROLLBACK');
            throw error;
        }
    } finally {
        await client.close();
    }
}
