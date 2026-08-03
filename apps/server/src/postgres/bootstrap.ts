import { SQL } from 'bun';
import { taskSchemaStatements } from './task-bootstrap.ts';

/**
 * Fresh-schema setup for the hosted Grotto server, mirroring the SQLite
 * bootstrap seam: this DDL is the schema of record, and `schema.ts` describes
 * the same tables for typed queries. There is no migration history.
 */
const schemaStatements = [
    `CREATE TABLE avatars (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT avatars_id_shape CHECK (id ~ '^avt_[a-z0-9]{16}$'),
        media_type text NOT NULL
            CONSTRAINT avatars_media_type CHECK (
                media_type IN ('image/jpeg', 'image/png', 'image/webp')
            ),
        byte_size integer NOT NULL
            CONSTRAINT avatars_size CHECK (byte_size > 0 AND byte_size <= 524288),
        sha256 text NOT NULL
            CONSTRAINT avatars_sha256 CHECK (sha256 ~ '^[a-f0-9]{64}$'),
        bytes bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE users (
        id text PRIMARY KEY NOT NULL,
        clerk_user_id text NOT NULL,
        display_name text,
        handle text,
        email text,
        description text,
        avatar_id text REFERENCES avatars (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX users_clerk_user_id_key ON users (clerk_user_id);',
    'CREATE UNIQUE INDEX users_handle_key ON users (handle) WHERE handle IS NOT NULL;',
    `CREATE TABLE servers (
        id text PRIMARY KEY NOT NULL,
        slug text NOT NULL,
        display_name text NOT NULL,
        last_chat_event_cursor bigint NOT NULL DEFAULT 0
            CONSTRAINT servers_nonnegative_chat_event_cursor
            CHECK (last_chat_event_cursor >= 0),
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX servers_slug_key ON servers (slug);',
    `CREATE TABLE server_deletions (
        id text PRIMARY KEY
            CONSTRAINT server_deletions_id_shape CHECK (id ~ '^sdl_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL,
        requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL
            CONSTRAINT server_deletions_status CHECK (status IN ('pending', 'completed', 'failed')),
        error text,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX server_deletions_requester_idx
        ON server_deletions (requested_by_user_id, created_at);`,
    `CREATE TABLE server_memberships (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role text NOT NULL CONSTRAINT server_memberships_role
            CHECK (role IN ('owner', 'admin', 'member')),
        revoked_at timestamptz,
        joined_at timestamptz NOT NULL DEFAULT now(),
        stint integer NOT NULL DEFAULT 1
            CONSTRAINT server_memberships_positive_stint CHECK (stint > 0),
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX server_memberships_server_user_key
        ON server_memberships (server_id, user_id);`,
    `CREATE INDEX server_memberships_user_idx
        ON server_memberships (user_id);`,
    `CREATE TABLE computers (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT computers_id_shape CHECK (id ~ '^cmp_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        attached_by_user_id text NOT NULL,
        credential_hash text NOT NULL UNIQUE
            CONSTRAINT computers_credential_hash_shape CHECK (credential_hash ~ '^[a-f0-9]{64}$'),
        product_version text,
        protocol_version integer,
        operating_system text,
        architecture text,
        reported_inventory jsonb,
        usage_snapshot jsonb,
        usage_reported_at timestamptz,
        health text NOT NULL DEFAULT 'offline'
            CONSTRAINT computers_health CHECK (
                health IN ('offline', 'healthy', 'degraded', 'update-required')
            ),
        update_phase text NOT NULL DEFAULT 'idle'
            CONSTRAINT computers_update_phase CHECK (
                update_phase IN (
                    'idle', 'checking', 'available', 'requested', 'downloading',
                    'verifying', 'installing',
                    'waiting-for-agents', 'restarting', 'complete', 'failed'
                )
            ),
        update_target_version text,
        update_detail text,
        update_downloaded_bytes integer,
        update_total_bytes integer,
        update_active_agent_count integer,
        update_failed_phase text,
        update_updated_at timestamptz,
        last_connected_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT computers_attacher_membership_fk
            FOREIGN KEY (server_id, attached_by_user_id)
            REFERENCES server_memberships (server_id, user_id)
    );`,
    'CREATE UNIQUE INDEX computers_server_id_key ON computers (server_id, id);',
    'CREATE INDEX computers_server_idx ON computers (server_id, created_at DESC);',
    `CREATE TABLE computer_setup_approvals (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT computer_setup_approvals_id_shape CHECK (id ~ '^cap_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        credential_hash text NOT NULL
            CONSTRAINT computer_setup_approvals_credential_hash_shape CHECK (credential_hash ~ '^[a-f0-9]{64}$'),
        approval_secret_hash text NOT NULL UNIQUE
            CONSTRAINT computer_setup_approvals_secret_hash_shape CHECK (approval_secret_hash ~ '^[a-f0-9]{64}$'),
        expires_at timestamptz NOT NULL,
        approved_at timestamptz,
        approved_by_user_id text,
        computer_id text UNIQUE REFERENCES computers (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT computer_setup_approvals_approval_shape CHECK (
            (approved_at IS NULL AND approved_by_user_id IS NULL AND computer_id IS NULL)
            OR (approved_at IS NOT NULL AND approved_by_user_id IS NOT NULL AND computer_id IS NOT NULL)
        )
    );`,
    'CREATE INDEX computer_setup_approvals_server_idx ON computer_setup_approvals (server_id, created_at DESC);',
    `CREATE TABLE server_invitations (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        email text NOT NULL
            CONSTRAINT server_invitations_email_normalized
            CHECK (email = lower(email) AND email <> ''),
        token_hash text NOT NULL,
        invited_by_user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        accepted_at timestamptz,
        accepted_user_id text,
        CONSTRAINT server_invitations_inviter_membership_fk
            FOREIGN KEY (server_id, invited_by_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT server_invitations_accepted_membership_fk
            FOREIGN KEY (server_id, accepted_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT server_invitations_terminal CHECK (
            (accepted_at IS NULL) = (accepted_user_id IS NULL)
            AND NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL)
        )
    );`,
    `CREATE UNIQUE INDEX server_invitations_token_hash_key
        ON server_invitations (token_hash);`,
    // At most one live invitation per address per Server. Expiry cannot join
    // this predicate — index predicates must be immutable and \`now()\` is not —
    // so issuing a fresh invitation first retires a lapsed one.
    `CREATE UNIQUE INDEX server_invitations_live_email_key
        ON server_invitations (server_id, email)
        WHERE revoked_at IS NULL AND accepted_at IS NULL;`,
    `CREATE INDEX server_invitations_server_idx
        ON server_invitations (server_id, created_at DESC);`,
    `CREATE TABLE agents (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        archetype text
            CONSTRAINT agents_archetype CHECK (
                archetype IS NULL OR archetype IN (
                    'operator', 'analyst', 'designer', 'writer',
                    'coordinator', 'patrol', 'gate', 'guide'
                )
            ),
        avatar_id text REFERENCES avatars (id) ON DELETE SET NULL,
        handle text NOT NULL,
        display_name text NOT NULL,
        description text
            CONSTRAINT agents_description_length CHECK (
                description IS NULL OR char_length(description) BETWEEN 1 AND 500
            ),
        home_timezone text NOT NULL,
        role text NOT NULL CONSTRAINT agents_role CHECK (role IN ('admin', 'member')),
        session_generation integer NOT NULL DEFAULT 1
            CONSTRAINT agents_positive_session_generation CHECK (session_generation > 0),
        session_reset_kind text NOT NULL DEFAULT 'session'
            CONSTRAINT agents_session_reset_kind CHECK (session_reset_kind IN ('full', 'session')),
        computer_id text,
        desired_runtime_id text,
        desired_model_id text,
        effective_runtime_id text,
        effective_model_id text,
        effective_reported_at timestamptz,
        effective_missing jsonb,
        retired_at timestamptz,
        created_by_user_id text REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT agents_computer_fk
            FOREIGN KEY (server_id, computer_id)
            REFERENCES computers (server_id, id),
        CONSTRAINT agents_configuration CHECK (
            (computer_id IS NULL AND desired_runtime_id IS NULL AND desired_model_id IS NULL)
            OR (computer_id IS NOT NULL AND desired_runtime_id IS NOT NULL AND desired_model_id IS NOT NULL)
        )
    );`,
    'CREATE UNIQUE INDEX agents_server_id_key ON agents (server_id, id);',
    `CREATE UNIQUE INDEX agents_server_handle_key
        ON agents (server_id, lower(handle));`,
    `CREATE TABLE mcp_connections (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT mcp_connections_id_shape CHECK (id ~ '^mcp_[A-Za-z0-9_-]{16}$'),
        account_label text,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        name text NOT NULL,
        auth text NOT NULL
            CONSTRAINT mcp_connections_auth CHECK (auth IN ('none', 'headers', 'oauth')),
        url text NOT NULL,
        connected boolean NOT NULL,
        header_names text[] NOT NULL,
        preset text CONSTRAINT mcp_connections_preset
            CHECK (preset IS NULL OR preset IN ('google-calendar', 'merchbase')),
        tools text[] NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );`,
    'CREATE UNIQUE INDEX mcp_connections_server_id_key ON mcp_connections (server_id, id);',
    `CREATE TABLE mcp_secrets (
        connection_id text PRIMARY KEY REFERENCES mcp_connections (id) ON DELETE CASCADE,
        secret jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
    );`,
    `CREATE TABLE agent_mcp_connection_grants (
        server_id text NOT NULL,
        agent_id text NOT NULL,
        connection_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, agent_id, connection_id),
        CONSTRAINT agent_mcp_connection_grants_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_mcp_connection_grants_connection_fk
            FOREIGN KEY (server_id, connection_id)
            REFERENCES mcp_connections (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE TABLE chats (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        kind text NOT NULL CONSTRAINT chats_kind CHECK (kind IN ('channel', 'dm', 'thread')),
        name text,
        is_all boolean NOT NULL DEFAULT false,
        dm_member_one_stint integer,
        dm_member_one_user_id text,
        dm_member_two_stint integer,
        dm_member_two_user_id text,
        dm_agent_id text,
        parent_chat_id text,
        parent_chat_kind text,
        anchor_message_id text,
        last_message_sequence integer NOT NULL DEFAULT 0
            CONSTRAINT chats_nonnegative_sequence CHECK (last_message_sequence >= 0),
        last_task_number integer NOT NULL DEFAULT 0
            CONSTRAINT chats_nonnegative_task_number CHECK (last_task_number >= 0),
        last_activity_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chats_server_id_kind_unique UNIQUE (server_id, id, kind),
        CONSTRAINT chats_shape CHECK (
            (
                kind = 'channel'
                AND name IS NOT NULL
                AND dm_member_one_stint IS NULL
                AND dm_member_one_user_id IS NULL
                AND dm_member_two_stint IS NULL
                AND dm_member_two_user_id IS NULL
                AND dm_agent_id IS NULL
                AND parent_chat_id IS NULL
                AND parent_chat_kind IS NULL
                AND anchor_message_id IS NULL
                AND (NOT is_all OR name = 'all')
            )
            OR (
                kind = 'dm'
                AND name IS NULL
                AND is_all = false
                AND dm_member_one_stint IS NOT NULL
                AND dm_member_one_user_id IS NOT NULL
                AND parent_chat_id IS NULL
                AND parent_chat_kind IS NULL
                AND anchor_message_id IS NULL
                AND (
                    (
                        dm_agent_id IS NULL
                        AND dm_member_two_stint IS NOT NULL
                        AND dm_member_two_user_id IS NOT NULL
                        AND dm_member_one_user_id < dm_member_two_user_id
                    )
                    OR (
                        dm_agent_id IS NOT NULL
                        AND dm_member_two_stint IS NULL
                        AND dm_member_two_user_id IS NULL
                    )
                )
            )
            OR (
                kind = 'thread'
                AND name IS NULL
                AND is_all = false
                AND dm_member_one_stint IS NULL
                AND dm_member_one_user_id IS NULL
                AND dm_member_two_stint IS NULL
                AND dm_member_two_user_id IS NULL
                AND dm_agent_id IS NULL
                AND parent_chat_id IS NOT NULL
                AND parent_chat_kind IN ('channel', 'dm')
                AND anchor_message_id IS NOT NULL
            )
        ),
        CONSTRAINT chats_dm_member_one_membership_fk
            FOREIGN KEY (server_id, dm_member_one_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT chats_dm_member_two_membership_fk
            FOREIGN KEY (server_id, dm_member_two_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT chats_thread_parent_fk
            FOREIGN KEY (server_id, parent_chat_id, parent_chat_kind)
            REFERENCES chats (server_id, id, kind),
        CONSTRAINT chats_dm_agent_fk
            FOREIGN KEY (server_id, dm_agent_id)
            REFERENCES agents (server_id, id)
    );`,
    'CREATE UNIQUE INDEX chats_server_id_key ON chats (server_id, id);',
    'CREATE UNIQUE INDEX chats_server_id_kind_key ON chats (server_id, id, kind);',
    `CREATE UNIQUE INDEX chats_server_channel_name_key
        ON chats (server_id, name) WHERE kind = 'channel';`,
    `CREATE UNIQUE INDEX chats_server_dm_pair_key
        ON chats (
            server_id,
            dm_member_one_user_id,
            dm_member_two_user_id,
            dm_member_one_stint,
            dm_member_two_stint
        ) WHERE kind = 'dm';`,
    `CREATE UNIQUE INDEX chats_server_thread_anchor_key
        ON chats (server_id, parent_chat_id, anchor_message_id) WHERE kind = 'thread';`,
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
    `CREATE TABLE channel_agent_participants (
        server_id text NOT NULL,
        chat_id text NOT NULL,
        chat_kind text NOT NULL DEFAULT 'channel'
            CONSTRAINT channel_agent_participants_kind CHECK (chat_kind = 'channel'),
        agent_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, chat_id, agent_id),
        CONSTRAINT channel_agent_participants_chat_fk
            FOREIGN KEY (server_id, chat_id, chat_kind)
            REFERENCES chats (server_id, id, kind) ON DELETE CASCADE,
        CONSTRAINT channel_agent_participants_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE TABLE chat_messages (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL,
        chat_id text NOT NULL,
        sequence integer NOT NULL CONSTRAINT chat_messages_positive_sequence
            CHECK (sequence > 0),
        author_user_id text,
        author_agent_id text,
        system_author text,
        content text NOT NULL,
        nonce text NOT NULL,
        search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chat_messages_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT chat_messages_author_membership_fk
            FOREIGN KEY (server_id, author_user_id)
            REFERENCES server_memberships (server_id, user_id),
        CONSTRAINT chat_messages_author_agent_fk
            FOREIGN KEY (server_id, author_agent_id)
            REFERENCES agents (server_id, id),
        CONSTRAINT chat_messages_author_shape CHECK (
            (author_user_id IS NOT NULL AND author_agent_id IS NULL AND system_author IS NULL)
            OR
            (author_agent_id IS NOT NULL AND author_user_id IS NULL AND system_author IS NULL)
            OR
            (author_user_id IS NULL AND author_agent_id IS NULL AND system_author IN ('reminder', 'session', 'task'))
        )
    );`,
    'CREATE UNIQUE INDEX chat_messages_server_id_key ON chat_messages (server_id, id);',
    `CREATE UNIQUE INDEX chat_messages_chat_sequence_key
        ON chat_messages (server_id, chat_id, sequence);`,
    `CREATE UNIQUE INDEX chat_messages_chat_nonce_key
        ON chat_messages (server_id, chat_id, nonce);`,
    `CREATE UNIQUE INDEX chat_messages_chat_id_key
        ON chat_messages (server_id, chat_id, id);`,
    `CREATE INDEX chat_messages_chat_sequence_idx
        ON chat_messages (server_id, chat_id, sequence);`,
    `CREATE INDEX chat_messages_search_idx
        ON chat_messages USING gin (search_vector);`,
    // Per-launch runner authority. A Computer mints one scoped credential per
    // Agent launch from its Computer credential; the Agent process never sees
    // it. The row is revoked when the launch ends, so a stale token fails
    // closed. Only the hash is stored — the token value never touches the DB.
    `CREATE TABLE agent_runner_credentials (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT agent_runner_credentials_id_shape CHECK (id ~ '^arc_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        computer_id text NOT NULL,
        agent_id text NOT NULL,
        chat_id text NOT NULL,
        run_id text NOT NULL,
        token_hash text NOT NULL UNIQUE
            CONSTRAINT agent_runner_credentials_token_hash_shape CHECK (token_hash ~ '^[a-f0-9]{64}$'),
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
        revoked_at timestamptz,
        CONSTRAINT agent_runner_credentials_computer_fk
            FOREIGN KEY (server_id, computer_id)
            REFERENCES computers (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_runner_credentials_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_runner_credentials_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE INDEX agent_runner_credentials_agent_idx
        ON agent_runner_credentials (server_id, agent_id, created_at DESC);`,
    // Compact turn activity. Durable collaboration and this summary live
    // Server-side; the raw transcript, logs, and workspace stay Computer-local
    // behind the authorized live relay and never land here.
    `CREATE TABLE agent_turns (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT agent_turns_id_shape CHECK (id ~ '^atn_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        agent_id text NOT NULL,
        computer_id text NOT NULL,
        run_id text NOT NULL,
        status text NOT NULL
            CONSTRAINT agent_turns_status CHECK (status IN ('completed', 'failed')),
        message_count integer NOT NULL DEFAULT 0
            CONSTRAINT agent_turns_message_count CHECK (message_count >= 0),
        summary text NOT NULL,
        started_at timestamptz NOT NULL,
        ended_at timestamptz NOT NULL,
        reported_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT agent_turns_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_turns_computer_fk
            FOREIGN KEY (server_id, computer_id)
            REFERENCES computers (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE UNIQUE INDEX agent_turns_run_key
        ON agent_turns (server_id, agent_id, run_id);`,
    `CREATE INDEX agent_turns_agent_idx
        ON agent_turns (server_id, agent_id, reported_at DESC);`,
    // Durable per-Agent delivery state: the human Stop flag and the single
    // in-flight run. One row per Agent is the serialization boundary — a run is
    // owned per Agent, never per Computer. A null accepted_at on an active run
    // is an unacknowledged delivery the retry sweep resends.
    `CREATE TABLE agent_delivery (
        agent_id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        stopped boolean NOT NULL DEFAULT false,
        active_run_id text,
        active_run_chat_id text,
        active_run_computer_id text,
        active_run_runtime_id text,
        active_run_model_id text,
        agent_chain_turns integer NOT NULL DEFAULT 0
            CONSTRAINT agent_delivery_nonnegative_chain_turns CHECK (agent_chain_turns >= 0),
        accepted_at timestamptz,
        dispatched_at timestamptz,
        consecutive_failures integer NOT NULL DEFAULT 0
            CONSTRAINT agent_delivery_nonnegative_failures CHECK (consecutive_failures >= 0),
        retry_after timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT agent_delivery_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_delivery_active_run CHECK (
            (
                active_run_id IS NULL
                AND active_run_chat_id IS NULL
                AND active_run_computer_id IS NULL
                AND active_run_runtime_id IS NULL
                AND active_run_model_id IS NULL
                AND accepted_at IS NULL
                AND dispatched_at IS NULL
            )
            OR (
                active_run_id IS NOT NULL
                AND active_run_chat_id IS NOT NULL
                AND active_run_computer_id IS NOT NULL
                AND active_run_runtime_id IS NOT NULL
                AND active_run_model_id IS NOT NULL
            )
        )
    );`,
    // The durable pending inbox. A queued unit of work has a null run_id; a
    // drain stamps queued rows with the run that will carry them. A settled run
    // deletes its rows; a failed or stopped run clears the stamp to requeue.
    `CREATE TABLE agent_pending_work (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT agent_pending_work_id_shape CHECK (id ~ '^apw_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        agent_id text NOT NULL,
        chat_id text NOT NULL,
        content text NOT NULL,
        source text NOT NULL DEFAULT 'human',
        dedupe_key text NOT NULL,
        pierced boolean NOT NULL DEFAULT false,
        run_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT agent_pending_work_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_pending_work_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE UNIQUE INDEX agent_pending_work_dedupe_key
        ON agent_pending_work (server_id, agent_id, dedupe_key);`,
    `CREATE INDEX agent_pending_work_queue_idx
        ON agent_pending_work (server_id, agent_id, created_at);`,
    `CREATE TABLE agent_inbox_cursors (
        server_id text NOT NULL,
        agent_id text NOT NULL,
        session_generation integer NOT NULL,
        chat_id text NOT NULL,
        delivered_up_to_sequence integer NOT NULL DEFAULT 0,
        served_up_to_sequence integer NOT NULL DEFAULT 0,
        seen_up_to_sequence integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, agent_id, session_generation, chat_id),
        CONSTRAINT agent_inbox_cursors_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_inbox_cursors_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_inbox_cursors_nonnegative CHECK (
            delivered_up_to_sequence >= 0
            AND served_up_to_sequence >= 0
            AND seen_up_to_sequence >= 0
            AND session_generation > 0
        )
    );`,
    `CREATE TABLE agent_inbox_pierces (
        server_id text NOT NULL,
        agent_id text NOT NULL,
        session_generation integer NOT NULL,
        chat_id text NOT NULL,
        message_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        served_at timestamptz,
        seen_at timestamptz,
        PRIMARY KEY (server_id, agent_id, session_generation, chat_id, message_id),
        CONSTRAINT agent_inbox_pierces_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_inbox_pierces_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_inbox_pierces_message_fk
            FOREIGN KEY (server_id, message_id)
            REFERENCES chat_messages (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_inbox_pierces_generation CHECK (session_generation > 0)
    );`,
    `CREATE TABLE agent_message_drafts (
        server_id text NOT NULL,
        agent_id text NOT NULL,
        session_generation integer NOT NULL,
        chat_id text NOT NULL,
        content text NOT NULL,
        attachment_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        rehold_count integer NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, agent_id, session_generation, chat_id),
        CONSTRAINT agent_message_drafts_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_message_drafts_chat_fk
            FOREIGN KEY (server_id, chat_id)
            REFERENCES chats (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_message_drafts_shape CHECK (
            rehold_count > 0 AND session_generation > 0
        )
    );`,
    `CREATE TABLE attachments (
        id text PRIMARY KEY NOT NULL
            CONSTRAINT attachments_id_shape CHECK (id ~ '^att_[A-Za-z0-9_-]{16}$'),
        server_id text NOT NULL,
        chat_id text,
        uploader_user_id text,
        uploader_agent_id text,
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
        CONSTRAINT attachments_uploader_agent_fk
            FOREIGN KEY (server_id, uploader_agent_id)
            REFERENCES agents (server_id, id),
        CONSTRAINT attachments_message_fk
            FOREIGN KEY (server_id, chat_id, message_id)
            REFERENCES chat_messages (server_id, chat_id, id),
        CONSTRAINT attachments_message_ready CHECK (
            message_id IS NULL OR (
                chat_id IS NOT NULL AND state = 'ready'
                AND message_position IS NOT NULL AND message_position >= 0
            )
        ),
        CONSTRAINT attachments_uploader_shape CHECK (
            num_nonnulls(uploader_user_id, uploader_agent_id) = 1
        ),
        CONSTRAINT attachments_failure_shape CHECK (
            (state = 'failed') = (failure_code IS NOT NULL)
        )
    );`,
    'CREATE UNIQUE INDEX attachments_server_id_key ON attachments (server_id, id);',
    `CREATE UNIQUE INDEX attachments_user_nonce_key
        ON attachments (server_id, uploader_user_id, upload_nonce)
        WHERE uploader_user_id IS NOT NULL;`,
    `CREATE UNIQUE INDEX attachments_agent_nonce_key
        ON attachments (server_id, uploader_agent_id, upload_nonce)
        WHERE uploader_agent_id IS NOT NULL;`,
    `CREATE UNIQUE INDEX attachments_message_position_key
        ON attachments (server_id, message_id, message_position)
        WHERE message_id IS NOT NULL;`,
    `CREATE TABLE message_reactions (
        server_id text NOT NULL,
        message_id text NOT NULL,
        actor_agent_id text NOT NULL,
        emoji text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT message_reactions_message_fk
            FOREIGN KEY (server_id, message_id)
            REFERENCES chat_messages (server_id, id) ON DELETE CASCADE,
        CONSTRAINT message_reactions_actor_agent_fk
            FOREIGN KEY (server_id, actor_agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE UNIQUE INDEX message_reactions_actor_key
        ON message_reactions (server_id, message_id, actor_agent_id, emoji);`,
    `CREATE TABLE reminders (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        owner_agent_id text NOT NULL,
        title text NOT NULL CONSTRAINT reminders_title_length
            CHECK (char_length(title) BETWEEN 1 AND 300),
        anchor_chat_id text NOT NULL,
        anchor_message_id text NOT NULL,
        fire_at timestamptz NOT NULL,
        repeat text,
        timezone text NOT NULL,
        script text CONSTRAINT reminders_script_size
            CHECK (script IS NULL OR octet_length(script) BETWEEN 1 AND 16384),
        status text NOT NULL CONSTRAINT reminders_status
            CHECK (status IN ('scheduled', 'fired', 'canceled')),
        version integer NOT NULL DEFAULT 1
            CONSTRAINT reminders_positive_version CHECK (version > 0),
        schedule_receipt_message_id text,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT reminders_owner_agent_fk
            FOREIGN KEY (server_id, owner_agent_id)
            REFERENCES agents (server_id, id),
        CONSTRAINT reminders_anchor_chat_fk
            FOREIGN KEY (server_id, anchor_chat_id)
            REFERENCES chats (server_id, id),
        CONSTRAINT reminders_anchor_message_fk
            FOREIGN KEY (server_id, anchor_chat_id, anchor_message_id)
            REFERENCES chat_messages (server_id, chat_id, id),
        CONSTRAINT reminders_schedule_receipt_fk
            FOREIGN KEY (server_id, schedule_receipt_message_id)
            REFERENCES chat_messages (server_id, id)
    );`,
    'CREATE UNIQUE INDEX reminders_server_id_key ON reminders (server_id, id);',
    `CREATE INDEX reminders_due_idx
        ON reminders (fire_at, id) WHERE status = 'scheduled';`,
    `CREATE TABLE reminder_commands (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        actor_kind text NOT NULL CONSTRAINT reminder_commands_actor_kind
            CHECK (actor_kind IN ('agent', 'user')),
        actor_id text NOT NULL,
        command_id text NOT NULL,
        action text NOT NULL,
        request_fingerprint text NOT NULL,
        result_snapshot jsonb NOT NULL,
        reminder_id text NOT NULL,
        applied_version integer NOT NULL CONSTRAINT reminder_commands_positive_version
            CHECK (applied_version > 0),
        created_at timestamptz NOT NULL,
        CONSTRAINT reminder_commands_reminder_fk
            FOREIGN KEY (server_id, reminder_id)
            REFERENCES reminders (server_id, id) ON DELETE CASCADE
    );`,
    `CREATE UNIQUE INDEX reminder_commands_actor_command_key
        ON reminder_commands (server_id, actor_kind, actor_id, command_id);`,
    `CREATE TABLE reminder_fires (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        reminder_id text NOT NULL,
        scheduled_for timestamptz NOT NULL,
        fired_at timestamptz NOT NULL,
        script_exit_code integer,
        script_output text,
        script_timed_out boolean NOT NULL DEFAULT false,
        receipt_message_id text NOT NULL,
        CONSTRAINT reminder_fires_script_output_size
            CHECK (script_output IS NULL OR octet_length(script_output) <= 65536),
        CONSTRAINT reminder_fires_reminder_fk
            FOREIGN KEY (server_id, reminder_id)
            REFERENCES reminders (server_id, id) ON DELETE CASCADE,
        CONSTRAINT reminder_fires_receipt_fk
            FOREIGN KEY (server_id, receipt_message_id)
            REFERENCES chat_messages (server_id, id)
    );`,
    `CREATE UNIQUE INDEX reminder_fires_server_id_key
        ON reminder_fires (server_id, id);`,
    `CREATE UNIQUE INDEX reminder_fires_logical_fire_key
        ON reminder_fires (server_id, reminder_id, scheduled_for);`,
    `CREATE TABLE reminder_agent_attention (
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
        agent_id text NOT NULL,
        reminder_id text NOT NULL,
        fire_id text NOT NULL,
        anchor_chat_id text NOT NULL,
        receipt_message_id text NOT NULL,
        attention_kind text NOT NULL,
        script text,
        queued_at timestamptz NOT NULL,
        CONSTRAINT reminder_agent_attention_shape CHECK (
            (attention_kind = 'reminder' AND script IS NULL)
            OR
            (attention_kind = 'reminder_script'
                AND octet_length(script) BETWEEN 1 AND 16384)
        ),
        CONSTRAINT reminder_agent_attention_agent_fk
            FOREIGN KEY (server_id, agent_id) REFERENCES agents (server_id, id),
        CONSTRAINT reminder_agent_attention_reminder_fk
            FOREIGN KEY (server_id, reminder_id)
            REFERENCES reminders (server_id, id) ON DELETE CASCADE,
        CONSTRAINT reminder_agent_attention_fire_fk
            FOREIGN KEY (server_id, fire_id)
            REFERENCES reminder_fires (server_id, id) ON DELETE CASCADE,
        CONSTRAINT reminder_agent_attention_anchor_chat_fk
            FOREIGN KEY (server_id, anchor_chat_id) REFERENCES chats (server_id, id),
        CONSTRAINT reminder_agent_attention_receipt_fk
            FOREIGN KEY (server_id, receipt_message_id)
            REFERENCES chat_messages (server_id, id)
    );`,
    `CREATE UNIQUE INDEX reminder_agent_attention_server_id_key
        ON reminder_agent_attention (server_id, id);`,
    `CREATE UNIQUE INDEX reminder_agent_attention_fire_key
        ON reminder_agent_attention (server_id, fire_id);`,
    `ALTER TABLE chats ADD CONSTRAINT chats_thread_anchor_fk
        FOREIGN KEY (server_id, parent_chat_id, anchor_message_id)
        REFERENCES chat_messages (server_id, chat_id, id);`,
    `CREATE TABLE thread_follows (
        server_id text NOT NULL,
        thread_chat_id text NOT NULL,
        thread_chat_kind text NOT NULL DEFAULT 'thread'
            CONSTRAINT thread_follows_kind CHECK (thread_chat_kind = 'thread'),
        user_id text NOT NULL,
        followed boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, thread_chat_id, user_id),
        CONSTRAINT thread_follows_thread_fk
            FOREIGN KEY (server_id, thread_chat_id, thread_chat_kind)
            REFERENCES chats (server_id, id, kind) ON DELETE CASCADE,
        CONSTRAINT thread_follows_membership_fk
            FOREIGN KEY (server_id, user_id)
            REFERENCES server_memberships (server_id, user_id) ON DELETE CASCADE
    );`,
    `CREATE TABLE agent_channel_mutes (
        server_id text NOT NULL,
        agent_id text NOT NULL,
        chat_id text NOT NULL,
        chat_kind text NOT NULL DEFAULT 'channel'
            CONSTRAINT agent_channel_mutes_kind CHECK (chat_kind = 'channel'),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, agent_id, chat_id),
        CONSTRAINT agent_channel_mutes_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_channel_mutes_chat_fk
            FOREIGN KEY (server_id, chat_id, chat_kind)
            REFERENCES chats (server_id, id, kind) ON DELETE CASCADE
    );`,
    `CREATE TABLE agent_thread_follows (
        server_id text NOT NULL,
        agent_id text NOT NULL,
        thread_chat_id text NOT NULL,
        thread_chat_kind text NOT NULL DEFAULT 'thread'
            CONSTRAINT agent_thread_follows_kind CHECK (thread_chat_kind = 'thread'),
        followed boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (server_id, agent_id, thread_chat_id),
        CONSTRAINT agent_thread_follows_agent_fk
            FOREIGN KEY (server_id, agent_id)
            REFERENCES agents (server_id, id) ON DELETE CASCADE,
        CONSTRAINT agent_thread_follows_thread_fk
            FOREIGN KEY (server_id, thread_chat_id, thread_chat_kind)
            REFERENCES chats (server_id, id, kind) ON DELETE CASCADE
    );`,
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
    ...taskSchemaStatements,
    `CREATE TABLE chat_events (
        cursor bigint NOT NULL CONSTRAINT chat_events_positive_cursor CHECK (cursor > 0),
        id text PRIMARY KEY NOT NULL,
        server_id text NOT NULL,
        chat_id text,
        event_type text NOT NULL,
        message_id text,
        label_id text,
        reader_user_id text,
        reminder_id text,
        reminder_action text,
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
        CONSTRAINT chat_events_reminder_fk
            FOREIGN KEY (server_id, reminder_id)
            REFERENCES reminders (server_id, id) ON DELETE CASCADE,
        CONSTRAINT chat_events_shape CHECK (
            (
                event_type = 'message.created'
                AND chat_id IS NOT NULL
                AND message_id IS NOT NULL
                AND label_id IS NULL
                AND reader_user_id IS NULL
                AND sequence > 0
            )
            OR (
                event_type IN ('task.created', 'task.updated')
                AND chat_id IS NOT NULL
                AND message_id IS NOT NULL
                AND label_id IS NULL
                AND reader_user_id IS NULL
                AND reminder_id IS NULL
                AND reminder_action IS NULL
                AND sequence > 0
            )
            OR (
                event_type = 'chat.read'
                AND chat_id IS NOT NULL
                AND message_id IS NULL
                AND label_id IS NULL
                AND reader_user_id IS NOT NULL
                AND reminder_id IS NULL
                AND reminder_action IS NULL
                AND sequence >= 0
            )
            OR (
                event_type = 'thread.follow.updated'
                AND chat_id IS NOT NULL
                AND message_id IS NULL
                AND label_id IS NULL
                AND reader_user_id IS NOT NULL
                AND reminder_id IS NULL
                AND reminder_action IS NULL
                AND sequence >= 0
            )
            OR (
                event_type = 'reminder.changed'
                AND message_id IS NULL
                AND reader_user_id IS NULL
                AND reminder_id IS NOT NULL
                AND reminder_action IN (
                    'scheduled', 'updated', 'snoozed', 'canceled', 'fired'
                )
                AND sequence >= 0
            )
            OR (
                event_type = 'task.label.updated'
                AND chat_id IS NULL
                AND message_id IS NULL
                AND label_id IS NOT NULL
                AND reader_user_id IS NULL
                AND sequence = 0
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
