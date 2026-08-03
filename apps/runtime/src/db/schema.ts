import { repairRuntimeSchema } from './schema-repairs.ts';
import type { Database } from './sqlite.ts';

export const RUNTIME_SCHEMA = `
CREATE TABLE IF NOT EXISTS runtime_metadata (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tavern_vault_secrets (
  id          TEXT PRIMARY KEY,
  secret_json TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_connections (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  preset        TEXT CHECK (preset IN ('google-calendar', 'merchbase')),
  transport     TEXT NOT NULL CHECK (transport IN ('http', 'stdio')),
  auth          TEXT NOT NULL CHECK (auth IN ('none', 'headers', 'oauth')),
  url           TEXT,
  command       TEXT,
  args_json     TEXT NOT NULL DEFAULT '[]',
  header_names_json TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  CHECK ((transport = 'http' AND url IS NOT NULL AND command IS NULL)
      OR (transport = 'stdio' AND command IS NOT NULL AND url IS NULL))
);

CREATE TABLE IF NOT EXISTS agent_mcp_tool_grants (
  agent_id      TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  tool_name     TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY(agent_id, connection_id, tool_name),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(connection_id) REFERENCES mcp_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_mcp_tool_grants_connection
  ON agent_mcp_tool_grants(connection_id, agent_id, tool_name);

CREATE TABLE IF NOT EXISTS agent_host_tool_grants (
  agent_id   TEXT NOT NULL,
  tool_id    TEXT NOT NULL CHECK (tool_id IN ('browser', 'web_fetch')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, tool_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mcp_tool_audit (
  call_id       TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  turn_id       TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  tool_name     TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  completed_at  TEXT,
  outcome       TEXT NOT NULL CHECK (outcome IN ('running', 'succeeded', 'failed')),
  error         TEXT,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(connection_id) REFERENCES mcp_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_audit_agent_started
  ON mcp_tool_audit(agent_id, started_at DESC);

CREATE TABLE IF NOT EXISTS browser_settings (
  singleton    INTEGER PRIMARY KEY CHECK (singleton = 1),
  enabled      INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  profile_name TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_capabilities (
  id                TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  state             TEXT NOT NULL CHECK (state IN ('degraded', 'healthy', 'unauthorized', 'unavailable', 'unknown')),
  healthy           INTEGER NOT NULL CHECK (healthy IN (0, 1)),
  reason            TEXT,
  technical_message TEXT,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  checked_at        TEXT,
  last_healthy_at   TEXT,
  next_check_at     TEXT,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_agent_instructions (
  agent_id      TEXT PRIMARY KEY,
  agent_name    TEXT NOT NULL,
  workspace_dir TEXT NOT NULL,
  rendered_hash TEXT,
  rendered_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  avatar_url             TEXT,
  primary_color          TEXT,
  workspace_folder       TEXT NOT NULL,
  enabled_skill_ids_json TEXT NOT NULL DEFAULT '[]',
  is_admin               INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  raw_json               TEXT NOT NULL,
  last_synced_at         TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_name
  ON agents(name, id);

CREATE TABLE IF NOT EXISTS agent_skill_assignments (
  agent_id   TEXT NOT NULL,
  skill_id   TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, skill_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_skill_assignments_enabled
  ON agent_skill_assignments(agent_id, enabled, skill_id);

CREATE TABLE IF NOT EXISTS skill_settings (
  skill_id   TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_sources (
  skill_id            TEXT PRIMARY KEY,
  source              TEXT NOT NULL CHECK (source IN ('seeded', 'hub', 'agent', 'external')),
  state               TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'stale', 'archived')),
  created_by_agent_id TEXT,
  installed_hash      TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  archived_at         TEXT
);

CREATE TABLE IF NOT EXISTS skill_usage (
  skill_id    TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('injected', 'viewed')),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skill_usage_skill_occurred
  ON skill_usage(skill_id, occurred_at);

CREATE TABLE IF NOT EXISTS agent_runtime_profiles (
  agent_id           TEXT PRIMARY KEY,
  default_model_json TEXT NOT NULL,
  sandbox_mode       TEXT NOT NULL DEFAULT 'none' CHECK (sandbox_mode IN ('docker', 'none', 'podman')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_model_selections (
  agent_id          TEXT PRIMARY KEY,
  provider_id       TEXT NOT NULL,
  model_id          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('invalid', 'unknown', 'valid')),
  invalid_reason    TEXT,
  last_validated_at TEXT,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_catalog_cache (
  provider_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  models_json TEXT NOT NULL,
  warning TEXT,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT,
  fingerprint TEXT
);

CREATE TABLE IF NOT EXISTS runtime_model_providers (
  provider_id TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm', 'task', 'thread')),
  title                 TEXT,
  parent_chat_id        TEXT REFERENCES chats(id) ON DELETE CASCADE,
  anchor_message_id     TEXT,
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS thread_follows (
  thread_chat_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  followed       INTEGER NOT NULL DEFAULT 1 CHECK (followed IN (0, 1)),
  created_at     TEXT NOT NULL,
  PRIMARY KEY (thread_chat_id, participant_id),
  FOREIGN KEY (thread_chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id                  TEXT NOT NULL,
  id                       TEXT NOT NULL,
  kind                     TEXT NOT NULL CHECK (kind IN ('user', 'agent', 'system', 'external', 'plugin')),
  label                    TEXT,
  metadata_json            TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(chat_id, id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- One global session per agent spanning all its chats (specs/sessions.md,
-- ADR 0011). Chat-scoped state lives in agent_inbox_cursors.
CREATE TABLE IF NOT EXISTS agent_sessions (
  id                     TEXT PRIMARY KEY,
  agent_id               TEXT NOT NULL,
  generation             INTEGER NOT NULL CHECK (generation > 0),
  effective_model_json   TEXT NOT NULL,
  runtime_session_id     TEXT,
  resume_state_json      TEXT,
  instructions_hash      TEXT,
  status                 TEXT NOT NULL CHECK (status IN ('active', 'archived', 'stopped')),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  archived_at            TEXT,
  last_turn_at           TEXT,
  UNIQUE(agent_id, generation),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent
  ON agent_sessions(agent_id, status, generation DESC);

-- One active session per agent is a schema invariant, not just a
-- transaction discipline (specs/sessions.md).
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_one_active
  ON agent_sessions(agent_id) WHERE status = 'active';

-- Two-cursor inbox ledger (I3): per (session, target) 'delivered' is inbox
-- transport state (muted targets never advance it) and 'seen' is the sole
-- model-seen authority for freshness holds and catch-up. Proof-based
-- advancement only: prompt-embedded envelopes at turn settle, CLI pull
-- outputs when the tool result commits, hold catch-up rows. Notices and
-- wakes advance nothing.
CREATE TABLE IF NOT EXISTS agent_inbox_cursors (
  session_id       TEXT NOT NULL,
  chat_id          TEXT NOT NULL,
  delivered_up_to_seq INTEGER NOT NULL DEFAULT 0 CHECK (delivered_up_to_seq >= 0),
  seen_up_to_seq   INTEGER NOT NULL DEFAULT 0 CHECK (seen_up_to_seq >= 0),
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (session_id, chat_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Channel mutes are agent-owned attention state (I1): mute suppresses
-- ordinary delivery from a channel and its threads without leaving.
CREATE TABLE IF NOT EXISTS agent_channel_mutes (
  agent_id   TEXT NOT NULL,
  chat_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, chat_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Personal @mentions pierce mutes/unfollows as single messages that do not
-- re-follow (I1). Pierce rows queue exactly those messages for the next
-- drain without moving the muted target's delivered cursor.
CREATE TABLE IF NOT EXISTS agent_inbox_pierces (
  session_id TEXT NOT NULL,
  chat_id    TEXT NOT NULL,
  message_id TEXT NOT NULL,
  served_run_id TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, chat_id, message_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Server-served pull horizon, session-scoped like the seen ledger. This
-- supplements freshness hold decisions only; the session seen ledger remains
-- catch-up authority.
CREATE TABLE IF NOT EXISTS agent_session_served_cursors (
  session_id      TEXT NOT NULL,
  chat_id         TEXT NOT NULL,
  served_up_to_seq INTEGER NOT NULL DEFAULT 0 CHECK (served_up_to_seq >= 0),
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (session_id, chat_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_message_drafts (
  agent_id           TEXT NOT NULL,
  chat_id            TEXT NOT NULL,
  content            TEXT NOT NULL,
  attachment_ids_json TEXT NOT NULL DEFAULT '[]',
  rehold_count       INTEGER NOT NULL DEFAULT 0 CHECK (rehold_count >= 0),
  saved_at           TEXT NOT NULL,
  PRIMARY KEY (agent_id, chat_id),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Floating turns (I1): a turn anchors to the agent's global session, never a
-- chat. 'kind' is the turn shape — 'start' for the bare Start. turn, 'drain'
-- for inbox deliveries. Prompt evidence and errors ride metadata_json.
CREATE TABLE IF NOT EXISTS agent_turns (
  id                      TEXT PRIMARY KEY,
  agent_id                TEXT NOT NULL,
  agent_session_id        TEXT NOT NULL,
  kind                    TEXT NOT NULL CHECK (kind IN ('start', 'drain')),
  status                  TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  metadata_json           TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  started_at              TEXT,
  completed_at            TEXT,
  FOREIGN KEY(agent_session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_turns_session_status
  ON agent_turns(agent_session_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_turns_agent_created
  ON agent_turns(agent_id, created_at);

-- Per-turn workspace file-change evidence: the files a turn created, modified,
-- or deleted in the agent workspace, with bounded before/after text for diff
-- rendering. Filled by snapshot-compare when the turn settles; the summary
-- rides a workspace_changes activity row while contents load on demand.
CREATE TABLE IF NOT EXISTS agent_turn_file_changes (
  run_id      TEXT NOT NULL,
  path        TEXT NOT NULL,
  change      TEXT NOT NULL CHECK (change IN ('created', 'modified', 'deleted')),
  before_text TEXT,
  after_text  TEXT,
  omitted     TEXT CHECK (omitted IS NULL OR omitted IN ('binary', 'too-large')),
  before_size INTEGER,
  after_size  INTEGER,
  additions   INTEGER NOT NULL DEFAULT 0,
  deletions   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (run_id, path),
  FOREIGN KEY(run_id) REFERENCES agent_turns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_tasks (
  message_id     TEXT PRIMARY KEY,
  chat_id        TEXT NOT NULL,
  number         INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'closed')),
  assignee_id    TEXT,
  claimed_at     TEXT,
  priority       TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'urgent', 'high', 'medium', 'low')),
  label_ids_json TEXT NOT NULL DEFAULT '[]',
  origin         TEXT NOT NULL CHECK (origin IN ('composed', 'converted')),
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE(chat_id, number),
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_tasks_chat_status
  ON message_tasks(chat_id, status);

CREATE TABLE IF NOT EXISTS labels (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL CHECK (color IN ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink', 'gray')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_lower_name
  ON labels(lower(name));

CREATE TABLE IF NOT EXISTS reminders (
  id                TEXT PRIMARY KEY,
  owner_agent_id    TEXT NOT NULL,
  title             TEXT NOT NULL,
  anchor_chat_id    TEXT NOT NULL,
  anchor_message_id TEXT NOT NULL,
  fire_at_ms        INTEGER NOT NULL,
  repeat            TEXT,
  script            TEXT,
  status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'fired', 'canceled')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY(owner_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY(anchor_chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_due
  ON reminders(status, fire_at_ms);

CREATE INDEX IF NOT EXISTS idx_reminders_owner
  ON reminders(owner_agent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS reminder_runs (
  id               TEXT PRIMARY KEY,
  reminder_id      TEXT NOT NULL,
  fired_at         TEXT NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('fired', 'quiet', 'error')),
  output           TEXT,
  script_exit_code INTEGER,
  script_stderr    TEXT,
  message_id       TEXT,
  error_message    TEXT,
  FOREIGN KEY(reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminder_runs_reminder
  ON reminder_runs(reminder_id, fired_at DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(message_id, actor_id, emoji),
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  media_type  TEXT,
  byte_size   INTEGER NOT NULL CHECK (byte_size >= 0),
  path        TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_extraction_cursors (
  chat_id                  TEXT NOT NULL,
  agent_participant_id     TEXT NOT NULL,
  agent_id                 TEXT NOT NULL,
  last_extracted_sequence  INTEGER NOT NULL DEFAULT 0 CHECK (last_extracted_sequence >= 0),
  last_extracted_at        TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY(chat_id, agent_participant_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_extraction_cursors_agent
  ON memory_extraction_cursors(agent_id, updated_at);

CREATE TABLE IF NOT EXISTS memory_extraction_debounces (
  chat_id                  TEXT NOT NULL,
  agent_participant_id     TEXT NOT NULL,
  agent_id                 TEXT NOT NULL,
  pending_since            TEXT NOT NULL,
  last_activity_at         TEXT NOT NULL,
  scheduled_for            TEXT NOT NULL,
  target_sequence          INTEGER NOT NULL CHECK (target_sequence >= 0),
  attempts                 INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at               TEXT NOT NULL,
  PRIMARY KEY(chat_id, agent_participant_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_extraction_debounces_due
  ON memory_extraction_debounces(scheduled_for);

CREATE TABLE IF NOT EXISTS memory_jobs (
  id                     TEXT PRIMARY KEY,
  kind                   TEXT NOT NULL CHECK (kind IN ('extraction', 'dream', 'skill_review', 'curation')),
  status                 TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
  chat_id                TEXT,
  agent_id               TEXT NOT NULL,
  agent_participant_id   TEXT,
  model_category         TEXT CHECK (model_category IN ('fast', 'standard', 'deep', 'visual')),
  model_json             TEXT,
  source_start_sequence  INTEGER,
  source_end_sequence    INTEGER,
  output_path            TEXT,
  file_changes_json      TEXT NOT NULL DEFAULT '[]',
  usage_json             TEXT NOT NULL DEFAULT '{}',
  transcript_json        TEXT NOT NULL DEFAULT '[]',
  metadata_json          TEXT NOT NULL DEFAULT '{}',
  error                  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  started_at             TEXT,
  completed_at           TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_agent_created
  ON memory_jobs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_status_due
  ON memory_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS skill_review_queue (
  agent_id              TEXT PRIMARY KEY,
  chat_id               TEXT NOT NULL,
  signals_json          TEXT NOT NULL DEFAULT '[]',
  window_start_sequence INTEGER,
  window_end_sequence   INTEGER,
  attempts              INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  scheduled_for         TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_review_queue_due
  ON skill_review_queue(scheduled_for);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                TEXT PRIMARY KEY,
  chat_id           TEXT NOT NULL,
  sequence          INTEGER NOT NULL,
  author_id         TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           TEXT NOT NULL DEFAULT '',
  attachment_json   TEXT,
  nonce             TEXT,
  delivery_id       TEXT,
  created_at        TEXT NOT NULL,
  deleted_at        TEXT,
  metadata_json     TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  UNIQUE(chat_id, sequence),
  UNIQUE(chat_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_sequence
  ON chat_messages(chat_id, sequence);

CREATE TABLE IF NOT EXISTS chat_events (
  cursor          INTEGER PRIMARY KEY,
  id              TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  chat_id         TEXT NOT NULL,
  event_json      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  is_private      INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
  recipients_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_events_chat_cursor
  ON chat_events(chat_id, cursor);

CREATE TABLE IF NOT EXISTS chat_reads (
  chat_id            TEXT NOT NULL,
  reader_id          TEXT NOT NULL,
  last_read_sequence INTEGER NOT NULL,
  read_at            TEXT NOT NULL,
  cursor             INTEGER NOT NULL,
  PRIMARY KEY(chat_id, reader_id),
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_deliveries (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  turn_id     TEXT,
  message_id  TEXT NOT NULL,
  cursor      INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_responses (
  id                  TEXT PRIMARY KEY,
  chat_id             TEXT NOT NULL,
  participant_id      TEXT NOT NULL,
  request_message_id  TEXT,
  response_message_id TEXT,
  status              TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  summary             TEXT,
  metadata_json       TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  completed_at        TEXT,
  deleted_at          TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(request_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL,
  FOREIGN KEY(response_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_responses_chat_updated
  ON chat_responses(chat_id, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_chat_responses_chat_created
  ON chat_responses(chat_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_chat_responses_chat_active
  ON chat_responses(chat_id, status, response_message_id, deleted_at);

CREATE TABLE IF NOT EXISTS chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('reasoning', 'tool_call', 'tool_result', 'command', 'message', 'artifact', 'widget', 'custom')),
  status         TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  title          TEXT NOT NULL,
  detail         TEXT,
  summary        TEXT,
  artifact_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json  TEXT NOT NULL DEFAULT '{}',
  started_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  completed_at   TEXT,
  FOREIGN KEY(response_id) REFERENCES chat_responses(id) ON DELETE CASCADE,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  UNIQUE(response_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_chat_response_activity_response_sequence
  ON chat_response_activity(response_id, sequence);

CREATE INDEX IF NOT EXISTS idx_chat_response_activity_chat_sequence
  ON chat_response_activity(chat_id, sequence);

CREATE TABLE IF NOT EXISTS chat_artifacts (
  id            TEXT PRIMARY KEY,
  chat_id       TEXT NOT NULL,
  response_id   TEXT,
  activity_id   TEXT,
  message_id    TEXT,
  kind          TEXT NOT NULL CHECK (kind IN ('code', 'image', 'file', 'diff', 'document', 'chart', 'text', 'custom')),
  title         TEXT,
  content_text  TEXT,
  content_ref   TEXT,
  mime_type     TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY(response_id) REFERENCES chat_responses(id) ON DELETE SET NULL,
  FOREIGN KEY(activity_id) REFERENCES chat_response_activity(id) ON DELETE SET NULL,
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_artifacts_chat_updated
  ON chat_artifacts(chat_id, updated_at, id);

CREATE TABLE IF NOT EXISTS chat_pane_states (
  chat_id      TEXT PRIMARY KEY,
  revision     INTEGER NOT NULL,
  targets_json TEXT NOT NULL,
  active_key   TEXT,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_users (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  name          TEXT,
  email         TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_members (
  user_id    TEXT PRIMARY KEY REFERENCES identity_users(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_members_single_owner
  ON identity_members(role) WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS identity_invites (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL REFERENCES identity_users(id),
  created_at  TEXT NOT NULL,
  redeemed_by TEXT REFERENCES identity_users(id),
  redeemed_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_health_history (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  topic              TEXT NOT NULL,
  scan_id            TEXT,
  recorded_at        TEXT NOT NULL,
  articles_scanned   INTEGER,
  stale_count        INTEGER,
  low_quality_count  INTEGER,
  avg_staleness      REAL,
  avg_quality        REAL
);

CREATE INDEX IF NOT EXISTS idx_memory_health_history_topic
  ON memory_health_history(topic, recorded_at);
`;

export function ensureRuntimeSchema(db: Database): void {
    db.exec(RUNTIME_SCHEMA);
    repairRuntimeSchema(db);
    ensureColumn(db, {
        column: 'kind',
        definition:
            "TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm', 'task', 'thread'))",
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'parent_chat_id',
        definition: 'TEXT',
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'anchor_message_id',
        definition: 'TEXT',
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'followed',
        definition: 'INTEGER NOT NULL DEFAULT 1 CHECK (followed IN (0, 1))',
        table: 'thread_follows',
    });
    ensureColumn(db, {
        column: 'served_run_id',
        definition: 'TEXT',
        table: 'agent_inbox_pierces',
    });
    db.exec(
        'CREATE INDEX IF NOT EXISTS idx_chats_parent ON chats(parent_chat_id) WHERE parent_chat_id IS NOT NULL'
    );
    ensureColumn(db, {
        column: 'pinned',
        definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1))',
        table: 'chats',
    });
    ensureColumn(db, {
        column: 'deleted_at',
        definition: 'TEXT',
        table: 'chat_responses',
    });
    ensureColumn(db, {
        column: 'usage_json',
        definition: "TEXT NOT NULL DEFAULT '{}'",
        table: 'memory_jobs',
    });
    ensureColumn(db, {
        column: 'transcript_json',
        definition: "TEXT NOT NULL DEFAULT '[]'",
        table: 'memory_jobs',
    });
    ensureColumn(db, {
        column: 'state',
        definition: "TEXT NOT NULL DEFAULT 'active'",
        table: 'skill_sources',
    });
    ensureColumn(db, {
        column: 'archived_at',
        definition: 'TEXT',
        table: 'skill_sources',
    });
    ensureColumn(db, {
        column: 'installed_hash',
        definition: 'TEXT',
        table: 'skill_sources',
    });
    ensureColumn(db, {
        column: 'attempts',
        definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)',
        table: 'memory_extraction_debounces',
    });
    ensureColumn(db, {
        column: 'avatar_url',
        definition: 'TEXT',
        table: 'agents',
    });
}

function ensureColumn(
    db: Database,
    input: { column: string; definition: string; table: string }
): void {
    const rows = db.prepare(`PRAGMA table_info(${input.table})`).all() as Array<{
        name: string;
    }>;

    if (rows.some((row) => row.name === input.column)) {
        return;
    }

    db.exec(`ALTER TABLE ${input.table} ADD COLUMN ${input.column} ${input.definition}`);
}
