import type { SQL } from 'bun';

/**
 * Fresh-schema setup for the hosted Grotto server, mirroring the SQLite
 * bootstrap seam: this DDL is the schema of record, and `schema.ts` describes
 * the same tables for typed queries. There is no migration history.
 */
const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY NOT NULL,
        clerk_user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_key ON users (clerk_user_id);',
    `CREATE TABLE IF NOT EXISTS servers (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL,
        display_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS servers_slug_key ON servers (slug);',
    `CREATE TABLE IF NOT EXISTS server_memberships (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role text NOT NULL CONSTRAINT server_memberships_role
            CHECK (role IN ('owner', 'admin', 'member')),
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS server_memberships_server_user_key
        ON server_memberships (server_id, user_id);`,
    `CREATE INDEX IF NOT EXISTS server_memberships_user_idx
        ON server_memberships (user_id);`,
    `CREATE TABLE IF NOT EXISTS channels (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS channels_server_name_key
        ON channels (server_id, name);`,
    `CREATE TABLE IF NOT EXISTS channel_participants (
        channel_id text NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (channel_id, user_id)
    );`,
];

export async function ensureGrottoSchema(client: SQL) {
    for (const statement of schemaStatements) {
        await client.unsafe(statement);
    }
}
