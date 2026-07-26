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
        last_chat_event_cursor bigint NOT NULL DEFAULT 0
            CONSTRAINT servers_nonnegative_chat_event_cursor
            CHECK (last_chat_event_cursor >= 0),
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX servers_slug_key ON servers (slug);',
    `CREATE TABLE server_memberships (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role text NOT NULL CONSTRAINT server_memberships_role
            CHECK (role IN ('owner', 'admin', 'member')),
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX server_memberships_server_user_key
        ON server_memberships (server_id, user_id);`,
    `CREATE INDEX server_memberships_user_idx
        ON server_memberships (user_id);`,
    `CREATE TABLE chats (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        kind text NOT NULL CONSTRAINT chats_kind CHECK (kind IN ('channel', 'dm')),
        name text,
        is_all boolean NOT NULL DEFAULT false,
        dm_member_one_user_id text,
        dm_member_two_user_id text,
        last_message_sequence integer NOT NULL DEFAULT 0
            CONSTRAINT chats_nonnegative_sequence CHECK (last_message_sequence >= 0),
        last_activity_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chats_shape CHECK (
            (
                kind = 'channel'
                AND name IS NOT NULL
                AND dm_member_one_user_id IS NULL
                AND dm_member_two_user_id IS NULL
                AND (NOT is_all OR name = 'all')
            )
            OR (
                kind = 'dm'
                AND name IS NULL
                AND is_all = false
                AND dm_member_one_user_id IS NOT NULL
                AND dm_member_two_user_id IS NOT NULL
                AND dm_member_one_user_id < dm_member_two_user_id
            )
        ),
        CONSTRAINT chats_dm_member_one_membership_fk
            FOREIGN KEY (server_id, dm_member_one_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT chats_dm_member_two_membership_fk
            FOREIGN KEY (server_id, dm_member_two_user_id)
            REFERENCES server_memberships (server_id, user_id)
    );`,
    'CREATE UNIQUE INDEX chats_server_id_key ON chats (server_id, id);',
    'CREATE UNIQUE INDEX chats_server_id_kind_key ON chats (server_id, id, kind);',
    `CREATE UNIQUE INDEX chats_server_channel_name_key
        ON chats (server_id, name) WHERE kind = 'channel';`,
    `CREATE UNIQUE INDEX chats_server_dm_pair_key
        ON chats (server_id, dm_member_one_user_id, dm_member_two_user_id) WHERE kind = 'dm';`,
    `CREATE UNIQUE INDEX chats_server_all_key
        ON chats (server_id) WHERE is_all = true;`,
    `CREATE TABLE channel_participants (
        server_id text NOT NULL,
        chat_id text NOT NULL,
        chat_kind text NOT NULL DEFAULT 'channel'
            CONSTRAINT channel_participants_kind CHECK (chat_kind = 'channel'),
        user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, chat_id, user_id),
        CONSTRAINT channel_participants_chat_fk
            FOREIGN KEY (server_id, chat_id, chat_kind)
            REFERENCES chats (server_id, id, kind) ON DELETE CASCADE,
        CONSTRAINT channel_participants_membership_fk
            FOREIGN KEY (server_id, user_id)
            REFERENCES server_memberships (server_id, user_id) ON DELETE CASCADE
    );`,
    `CREATE INDEX channel_participants_user_idx
        ON channel_participants (server_id, user_id);`,
    `CREATE TABLE chat_messages (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL,
        chat_id text NOT NULL,
        sequence integer NOT NULL CONSTRAINT chat_messages_positive_sequence
            CHECK (sequence > 0),
        author_user_id text NOT NULL,
        content text NOT NULL,
        nonce text NOT NULL,
        search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chat_messages_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT chat_messages_author_membership_fk
            FOREIGN KEY (server_id, author_user_id)
            REFERENCES server_memberships (server_id, user_id)
    );`,
    'CREATE UNIQUE INDEX chat_messages_server_id_key ON chat_messages (server_id, id);',
    `CREATE UNIQUE INDEX chat_messages_chat_sequence_key
        ON chat_messages (server_id, chat_id, sequence);`,
    `CREATE UNIQUE INDEX chat_messages_chat_nonce_key
        ON chat_messages (server_id, chat_id, nonce);`,
    `CREATE INDEX chat_messages_chat_sequence_idx
        ON chat_messages (server_id, chat_id, sequence);`,
    `CREATE INDEX chat_messages_search_idx
        ON chat_messages USING gin (search_vector);`,
    `CREATE TABLE chat_reads (
        server_id text NOT NULL,
        chat_id text NOT NULL,
        reader_user_id text NOT NULL,
        sequence integer NOT NULL DEFAULT 0 CHECK (sequence >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, chat_id, reader_user_id),
        CONSTRAINT chat_reads_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT chat_reads_reader_membership_fk
            FOREIGN KEY (server_id, reader_user_id)
            REFERENCES server_memberships (server_id, user_id) ON DELETE CASCADE
    );`,
    `CREATE TABLE chat_events (
        cursor bigint NOT NULL CONSTRAINT chat_events_positive_cursor CHECK (cursor > 0),
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL,
        chat_id text NOT NULL,
        event_type text NOT NULL,
        message_id text,
        reader_user_id text,
        sequence integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chat_events_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT chat_events_message_fk
            FOREIGN KEY (server_id, message_id)
            REFERENCES chat_messages (server_id, id) ON DELETE CASCADE,
        CONSTRAINT chat_events_reader_membership_fk
            FOREIGN KEY (server_id, reader_user_id)
            REFERENCES server_memberships (server_id, user_id) ON DELETE CASCADE,
        CONSTRAINT chat_events_shape CHECK (
            (
                event_type = 'message.created'
                AND message_id IS NOT NULL
                AND reader_user_id IS NULL
                AND sequence > 0
            )
            OR (
                event_type = 'chat.read'
                AND message_id IS NULL
                AND reader_user_id IS NOT NULL
                AND sequence >= 0
            )
        )
    );`,
    `CREATE UNIQUE INDEX chat_events_server_cursor_key
        ON chat_events (server_id, cursor);`,
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
