import { databaseClient } from './index.ts';

const schemaStatements = [
    'PRAGMA foreign_keys = ON;',
    'PRAGMA journal_mode = WAL;',
    `CREATE TABLE IF NOT EXISTS agent_runtime_connections (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        auth_json TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 0,
        last_checked_at TEXT,
        last_error TEXT,
        last_synced_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS tavern_vault_secrets (
        id TEXT PRIMARY KEY NOT NULL,
        secret_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY NOT NULL,
        runtime_id TEXT NOT NULL,
        name TEXT NOT NULL,
        primary_color TEXT,
        enabled_skill_ids_json TEXT NOT NULL DEFAULT '[]',
        workspace_folder TEXT,
        raw_json TEXT NOT NULL,
        last_synced_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS agents_runtime_idx
        ON agents (runtime_id);`,
    `CREATE INDEX IF NOT EXISTS agents_last_synced_at_idx
        ON agents (last_synced_at);`,
    `CREATE TABLE IF NOT EXISTS skills (
        runtime_id TEXT NOT NULL,
        id TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        last_synced_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (runtime_id, id)
    );`,
    'CREATE INDEX IF NOT EXISTS skills_runtime_idx ON skills (runtime_id);',
    `CREATE TABLE IF NOT EXISTS claude_code_usage (
        id TEXT PRIMARY KEY NOT NULL,
        snapshot_json TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS codex_usage (
        id TEXT PRIMARY KEY NOT NULL,
        snapshot_json TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS openrouter_usage (
        id TEXT PRIMARY KEY NOT NULL,
        overview_json TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS usage_source_settings (
        id TEXT PRIMARY KEY NOT NULL,
        settings_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS job_executions (
        id TEXT PRIMARY KEY NOT NULL,
        job_slug TEXT NOT NULL,
        job_display_name TEXT NOT NULL,
        state TEXT NOT NULL,
        attempts_made INTEGER NOT NULL DEFAULT 0,
        progress INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        logs_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        updated_at TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS job_executions_created_at_idx ON job_executions (created_at);',
    `CREATE INDEX IF NOT EXISTS job_executions_job_slug_created_at_idx
        ON job_executions (job_slug, created_at);`,
    `CREATE INDEX IF NOT EXISTS job_executions_state_created_at_idx
        ON job_executions (state, created_at);`,
    `CREATE TABLE IF NOT EXISTS telemetry_ingest_cursors (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL,
        cursor_key TEXT NOT NULL,
        cursor_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS telemetry_ingest_cursors_source_key_idx ON telemetry_ingest_cursors (source, cursor_key);',
    `CREATE TABLE IF NOT EXISTS api_usage_events (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL,
        source_event_id TEXT,
        occurred_at TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        provider TEXT NOT NULL,
        credential_label TEXT NOT NULL,
        task_type TEXT NOT NULL,
        model TEXT,
        workspace_label TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
        pricing_version TEXT,
        meta_json TEXT
    );`,
    'CREATE INDEX IF NOT EXISTS api_usage_events_occurred_at_idx ON api_usage_events (occurred_at);',
    `CREATE INDEX IF NOT EXISTS api_usage_events_provider_label_occurred_idx
        ON api_usage_events (provider, credential_label, occurred_at);`,
    'CREATE INDEX IF NOT EXISTS api_usage_events_source_event_id_idx ON api_usage_events (source, source_event_id);',
    `CREATE TABLE IF NOT EXISTS api_usage_hourly (
        bucket_start TEXT NOT NULL,
        source TEXT NOT NULL,
        provider TEXT NOT NULL,
        credential_label TEXT NOT NULL,
        task_type TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'unknown',
        request_count INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
        pricing_version TEXT,
        PRIMARY KEY (bucket_start, source, provider, credential_label, task_type, model)
    );`,
    'CREATE INDEX IF NOT EXISTS api_usage_hourly_bucket_start_idx ON api_usage_hourly (bucket_start);',
    `CREATE INDEX IF NOT EXISTS api_usage_hourly_provider_label_bucket_idx
        ON api_usage_hourly (provider, credential_label, bucket_start);`,
    `CREATE TABLE IF NOT EXISTS cached_documents (
        id TEXT PRIMARY KEY NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS agent_profiles (
        runtime_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        primary_color TEXT,
        user_instructions TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (runtime_id, agent_id)
    );`,
    `CREATE TABLE IF NOT EXISTS messaging_bindings (
        id TEXT PRIMARY KEY NOT NULL,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        token TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        enabled TEXT NOT NULL,
        inbound_mode TEXT NOT NULL,
        match_json TEXT NOT NULL DEFAULT '{}',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS messaging_bindings_platform_idx
        ON messaging_bindings (platform);`,
    `CREATE INDEX IF NOT EXISTS messaging_bindings_agent_id_idx
        ON messaging_bindings (agent_id);`,
    `CREATE TABLE IF NOT EXISTS agent_thought_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        snapshot_hour TEXT NOT NULL,
        window_start_at TEXT NOT NULL,
        window_end_at TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        model TEXT NOT NULL,
        previous_snapshot_id TEXT,
        prompt_markdown TEXT NOT NULL,
        thoughts_markdown TEXT NOT NULL,
        session_keys_json TEXT NOT NULL DEFAULT '[]'
    );`,
    `CREATE INDEX IF NOT EXISTS agent_thought_snapshots_agent_idx
        ON agent_thought_snapshots (agent_id);`,
    `CREATE INDEX IF NOT EXISTS agent_thought_snapshots_generated_at_idx
        ON agent_thought_snapshots (generated_at);`,
    `CREATE INDEX IF NOT EXISTS agent_thought_snapshots_snapshot_hour_idx
        ON agent_thought_snapshots (snapshot_hour);`,
    `CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY NOT NULL,
        provider TEXT NOT NULL,
        account_key TEXT,
        external_id TEXT,
        observed_name TEXT NOT NULL,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS participants_observed_name_idx
        ON participants (observed_name);`,
    `CREATE INDEX IF NOT EXISTS participants_source_idx
        ON participants (provider, account_key, external_id);`,
    `CREATE TABLE IF NOT EXISTS participant_labels (
        id TEXT PRIMARY KEY NOT NULL,
        participant_id TEXT NOT NULL,
        label TEXT NOT NULL,
        normalized_label TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS participant_labels_participant_idx
        ON participant_labels (participant_id);`,
    `CREATE INDEX IF NOT EXISTS participant_labels_normalized_idx
        ON participant_labels (participant_id, normalized_label);`,
    `CREATE TABLE IF NOT EXISTS sync_state (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        json TEXT,
        hash TEXT,
        runtime_json TEXT,
        runtime_hash TEXT,
        status TEXT NOT NULL,
        last_attempted_at TEXT,
        last_successful_at TEXT,
        last_error TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, id)
    );`,
    `CREATE TABLE IF NOT EXISTS session_runs (
        id TEXT PRIMARY KEY NOT NULL,
        session_key TEXT NOT NULL,
        session_id TEXT NOT NULL,
        agent_id TEXT,
        parent_session_key TEXT,
        spawned_by TEXT,
        runtime TEXT,
        mode TEXT,
        status TEXT,
        label TEXT,
        thinking_level TEXT,
        delivery_context_json TEXT,
        spawned_by_message_id TEXT,
        spawned_by_tool_call_id TEXT,
        started_at TEXT,
        finished_at TEXT,
        updated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS session_runs_session_key_idx ON session_runs (session_key);',
    `CREATE INDEX IF NOT EXISTS session_runs_parent_session_key_idx
        ON session_runs (parent_session_key);`,
    'CREATE INDEX IF NOT EXISTS session_runs_started_at_idx ON session_runs (started_at);',
    'CREATE INDEX IF NOT EXISTS session_runs_status_idx ON session_runs (status);',
    `CREATE TABLE IF NOT EXISTS session_messages (
        id TEXT PRIMARY KEY NOT NULL,
        session_key TEXT NOT NULL,
        external_message_id TEXT,
        seq INTEGER,
        role TEXT NOT NULL,
        sender_label TEXT,
        actor_kind TEXT,
        actor_id TEXT,
        error_message TEXT,
        content_text TEXT,
        content_json TEXT,
        api TEXT,
        provider TEXT,
        model TEXT,
        canonical_model_id TEXT,
        agent_api TEXT,
        agent_model TEXT,
        agent_model_name_id TEXT,
        agent_provider TEXT,
        stop_reason TEXT,
        usage_json TEXT,
        timestamp TEXT,
        raw_json TEXT NOT NULL,
        synced_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS session_messages_actor_idx
        ON session_messages (actor_kind, actor_id);`,
    'CREATE INDEX IF NOT EXISTS session_messages_session_key_idx ON session_messages (session_key);',
    `CREATE INDEX IF NOT EXISTS session_messages_session_seq_idx
        ON session_messages (session_key, seq);`,
    `CREATE INDEX IF NOT EXISTS session_messages_session_timestamp_idx
        ON session_messages (session_key, timestamp);`,
    `CREATE TABLE IF NOT EXISTS session_message_parts (
        id TEXT PRIMARY KEY NOT NULL,
        session_key TEXT NOT NULL,
        message_id TEXT NOT NULL,
        part_index INTEGER NOT NULL,
        type TEXT NOT NULL,
        text TEXT,
        thinking_text TEXT,
        tool_call_id TEXT,
        tool_name TEXT,
        arguments_json TEXT,
        result_json TEXT,
        mime_type TEXT,
        raw_json TEXT NOT NULL,
        synced_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS session_message_parts_session_key_idx
        ON session_message_parts (session_key);`,
    `CREATE INDEX IF NOT EXISTS session_message_parts_message_id_idx
        ON session_message_parts (message_id);`,
    `CREATE INDEX IF NOT EXISTS session_message_parts_tool_call_id_idx
        ON session_message_parts (tool_call_id);`,
    `CREATE TABLE IF NOT EXISTS session_tool_calls (
        id TEXT PRIMARY KEY NOT NULL,
        session_key TEXT NOT NULL,
        message_id TEXT,
        tool_call_id TEXT,
        tool_name TEXT NOT NULL,
        agent_id TEXT,
        arguments_json TEXT,
        result_json TEXT,
        child_session_key TEXT,
        run_id TEXT,
        is_error INTEGER,
        started_at TEXT,
        finished_at TEXT,
        updated_at TEXT NOT NULL,
        raw_json TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS session_tool_calls_session_key_idx ON session_tool_calls (session_key);',
    'CREATE INDEX IF NOT EXISTS session_tool_calls_tool_call_id_idx ON session_tool_calls (tool_call_id);',
    `CREATE INDEX IF NOT EXISTS session_tool_calls_child_session_key_idx
        ON session_tool_calls (child_session_key);`,
    `CREATE TABLE IF NOT EXISTS session_links (
        id TEXT PRIMARY KEY NOT NULL,
        parent_session_key TEXT NOT NULL,
        child_session_key TEXT NOT NULL,
        link_type TEXT NOT NULL,
        source_message_id TEXT,
        source_tool_call_id TEXT,
        run_id TEXT,
        delivery_mode TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS session_links_parent_session_key_idx ON session_links (parent_session_key);',
    'CREATE INDEX IF NOT EXISTS session_links_child_session_key_idx ON session_links (child_session_key);',
    'CREATE INDEX IF NOT EXISTS session_links_link_type_idx ON session_links (link_type);',
    `CREATE TABLE IF NOT EXISTS session_deliveries (
        id TEXT PRIMARY KEY NOT NULL,
        parent_session_key TEXT NOT NULL,
        child_session_key TEXT NOT NULL,
        source_message_id TEXT,
        target_message_id TEXT,
        mode TEXT,
        status TEXT,
        run_id TEXT,
        cron_job_id TEXT,
        delivery_channel TEXT,
        delivery_target TEXT,
        transcript_path TEXT,
        stream_log_path TEXT,
        stats_json TEXT,
        delivered_at TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS session_deliveries_parent_session_key_idx ON session_deliveries (parent_session_key);',
    'CREATE INDEX IF NOT EXISTS session_deliveries_child_session_key_idx ON session_deliveries (child_session_key);',
    'CREATE INDEX IF NOT EXISTS session_deliveries_cron_job_id_idx ON session_deliveries (cron_job_id);',
    'CREATE INDEX IF NOT EXISTS session_deliveries_delivered_at_idx ON session_deliveries (delivered_at);',
    `CREATE TABLE IF NOT EXISTS session_access_events (
        id TEXT PRIMARY KEY NOT NULL,
        session_key TEXT NOT NULL,
        target_session_key TEXT,
        source_message_id TEXT,
        source_tool_call_id TEXT,
        tool_name TEXT,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        occurred_at TEXT NOT NULL,
        payload_json TEXT
    );`,
    'CREATE INDEX IF NOT EXISTS session_access_events_session_key_idx ON session_access_events (session_key);',
    `CREATE INDEX IF NOT EXISTS session_access_events_target_session_key_idx
        ON session_access_events (target_session_key);`,
    'CREATE INDEX IF NOT EXISTS session_access_events_occurred_at_idx ON session_access_events (occurred_at);',
    `CREATE TABLE IF NOT EXISTS session_artifacts (
        id TEXT PRIMARY KEY NOT NULL,
        session_key TEXT NOT NULL,
        run_id TEXT,
        message_id TEXT,
        tool_call_id TEXT,
        artifact_type TEXT NOT NULL,
        path TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        payload_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS session_artifacts_session_key_idx
        ON session_artifacts (session_key);`,
    'CREATE INDEX IF NOT EXISTS session_artifacts_run_id_idx ON session_artifacts (run_id);',
    'CREATE INDEX IF NOT EXISTS session_artifacts_message_id_idx ON session_artifacts (message_id);',
    `CREATE INDEX IF NOT EXISTS session_artifacts_artifact_type_idx
        ON session_artifacts (artifact_type);`,
    `CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        source TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        time TEXT NOT NULL,
        synced_at TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS logs_source_idx ON logs (source);',
    'CREATE INDEX IF NOT EXISTS logs_time_idx ON logs (time);',
];

function runSchemaStatements(filter: (statement: string) => boolean) {
    for (const statement of schemaStatements) {
        if (!filter(statement.trimStart())) {
            continue;
        }

        databaseClient.exec(statement);
    }
}

export function ensureDatabaseSchema() {
    runSchemaStatements((statement) => statement.startsWith('PRAGMA'));
    runSchemaStatements(
        (statement) => !(statement.startsWith('PRAGMA') || statement.startsWith('CREATE INDEX'))
    );
    runSchemaStatements((statement) => statement.startsWith('CREATE INDEX'));
    migrateAgentProfilesUserInstructions();
    dropAgentProfilesCharacter();
}

function dropAgentProfilesCharacter() {
    try {
        databaseClient.exec('ALTER TABLE agent_profiles DROP COLUMN avatar_character;');
    } catch {
        /* column already dropped or table is fresh */
    }
}

function migrateAgentProfilesUserInstructions() {
    try {
        databaseClient.exec('ALTER TABLE agent_profiles RENAME COLUMN soul TO user_instructions;');
        return;
    } catch {
        /* column already migrated or table is fresh */
    }

    try {
        databaseClient.exec(
            `ALTER TABLE agent_profiles ADD COLUMN user_instructions TEXT NOT NULL DEFAULT '';`
        );
    } catch {
        /* column already exists */
    }
}
