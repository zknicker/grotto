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
        last_chat_event_cursor bigint NOT NULL DEFAULT 0
            CONSTRAINT servers_nonnegative_chat_event_cursor
            CHECK (last_chat_event_cursor >= 0),
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS servers_slug_key ON servers (slug);',
    `CREATE TABLE IF NOT EXISTS server_memberships (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role text NOT NULL CONSTRAINT server_memberships_role
            CHECK (role IN ('owner', 'admin', 'member')),
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS server_memberships_server_user_key
        ON server_memberships (server_id, user_id);`,
    `CREATE INDEX IF NOT EXISTS server_memberships_user_idx
        ON server_memberships (user_id);`,
    `CREATE TABLE IF NOT EXISTS chats (
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
    'CREATE UNIQUE INDEX IF NOT EXISTS chats_server_id_key ON chats (server_id, id);',
    'CREATE UNIQUE INDEX IF NOT EXISTS chats_server_id_kind_key ON chats (server_id, id, kind);',
    `CREATE UNIQUE INDEX IF NOT EXISTS chats_server_channel_name_key
        ON chats (server_id, name) WHERE kind = 'channel';`,
    `CREATE UNIQUE INDEX IF NOT EXISTS chats_server_dm_pair_key
        ON chats (server_id, dm_member_one_user_id, dm_member_two_user_id) WHERE kind = 'dm';`,
    `CREATE UNIQUE INDEX IF NOT EXISTS chats_server_all_key
        ON chats (server_id) WHERE is_all = true;`,
    `CREATE TABLE IF NOT EXISTS channel_participants (
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
    `CREATE INDEX IF NOT EXISTS channel_participants_user_idx
        ON channel_participants (server_id, user_id);`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
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
    'CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_server_id_key ON chat_messages (server_id, id);',
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_server_chat_id_key
        ON chat_messages (server_id, chat_id, id);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_chat_sequence_key
        ON chat_messages (server_id, chat_id, sequence);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_chat_nonce_key
        ON chat_messages (server_id, chat_id, nonce);`,
    `CREATE INDEX IF NOT EXISTS chat_messages_chat_sequence_idx
        ON chat_messages (server_id, chat_id, sequence);`,
    `CREATE INDEX IF NOT EXISTS chat_messages_search_idx
        ON chat_messages USING gin (search_vector);`,
    `CREATE TABLE IF NOT EXISTS attachments (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT attachments_id_shape CHECK (id ~ '^att_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL,
        chat_id text NOT NULL,
        uploader_user_id text NOT NULL,
        upload_nonce text NOT NULL,
        filename text NOT NULL,
        media_type text NOT NULL,
        state text NOT NULL
            CONSTRAINT attachments_state
            CHECK (state IN ('pending', 'uploading', 'finalizing', 'ready', 'failed')),
        attempt_id text,
        staging_key text,
        byte_size bigint
            CONSTRAINT attachments_size
            CHECK (byte_size IS NULL OR (byte_size >= 0 AND byte_size <= 52428800)),
        sha256 text
            CONSTRAINT attachments_sha256
            CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
        failure_code text,
        message_id text,
        message_position integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        ready_at timestamptz,
        failed_at timestamptz,
        CONSTRAINT attachments_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT attachments_uploader_membership_fk
            FOREIGN KEY (server_id, uploader_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT attachments_message_fk
            FOREIGN KEY (server_id, chat_id, message_id)
            REFERENCES chat_messages (server_id, chat_id, id),
        CONSTRAINT attachments_message_ready CHECK (
            message_id IS NULL OR (
                state = 'ready' AND message_position IS NOT NULL AND message_position >= 0
            )
        ),
        CONSTRAINT attachments_failure_shape CHECK (
            (state = 'failed') = (failure_code IS NOT NULL)
        )
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS attachments_server_id_key ON attachments (server_id, id);',
    `CREATE UNIQUE INDEX IF NOT EXISTS attachments_uploader_nonce_key
        ON attachments (server_id, uploader_user_id, upload_nonce);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS attachments_message_position_key
        ON attachments (server_id, message_id, message_position)
        WHERE message_id IS NOT NULL;`,
    `CREATE TABLE IF NOT EXISTS chat_reads (
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
    `CREATE TABLE IF NOT EXISTS chat_events (
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
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_events_server_cursor_key
        ON chat_events (server_id, cursor);`,
];

export async function ensureGrottoSchema(client: SQL) {
    for (const statement of schemaStatements) {
        await client.unsafe(statement);
    }
}
