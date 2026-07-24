import { repairAgentTurnShape } from './agent-turn-schema-repair.ts';
import type { Database } from './sqlite.ts';

const CHAT_RESPONSE_ACTIVITY_TABLE = `
CREATE TABLE chat_response_activity (
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
)`;

const CHAT_RESPONSE_ACTIVITY_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_chat_response_activity_response_sequence
  ON chat_response_activity(response_id, sequence);

CREATE INDEX IF NOT EXISTS idx_chat_response_activity_chat_sequence
  ON chat_response_activity(chat_id, sequence);
`;

const CHATS_TABLE = `
CREATE TABLE chats (
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
)`;

const MEMORY_JOBS_TABLE = `
CREATE TABLE memory_jobs (
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
)`;

const MEMORY_JOBS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_memory_jobs_agent_created
  ON memory_jobs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_jobs_status_due
  ON memory_jobs(status, created_at);
`;

export function repairRuntimeSchema(db: Database): void {
    repairAgentTurnShape(db);
    ensureChatResponseActivityWidgetKind(db);
    ensureChatsKinds(db);
    ensureMemoryJobsSkillReviewKind(db);
    hydrateAgentSkillAssignments(db);
    hydrateDefaultHostToolGrants(db);
}

function ensureChatsKinds(db: Database): void {
    const sql = tableSql(db, 'chats');

    if (!sql || (sql.includes("'task'") && sql.includes("'thread'"))) {
        return;
    }

    const columns = tableColumns(db, 'chats');
    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.chats_rebuild;
CREATE TEMP TABLE chats_rebuild AS
  SELECT id, kind, title,
         ${columnExpression(columns, 'parent_chat_id', 'NULL')} AS parent_chat_id,
         ${columnExpression(columns, 'anchor_message_id', 'NULL')} AS anchor_message_id,
         pinned, metadata_json, created_at, updated_at,
         last_message_sequence
  FROM chats;
DROP TABLE chats;
${CHATS_TABLE};
INSERT INTO chats
  (id, kind, title, parent_chat_id, anchor_message_id, pinned, metadata_json,
   created_at, updated_at, last_message_sequence)
  SELECT id, kind, title, parent_chat_id, anchor_message_id, pinned,
         metadata_json, created_at, updated_at, last_message_sequence
  FROM chats_rebuild;
DROP TABLE temp.chats_rebuild;
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function ensureChatResponseActivityWidgetKind(db: Database): void {
    const sql = tableSql(db, 'chat_response_activity');

    if (!sql || (sql.includes("'widget'") && !sql.includes("'rich_response'"))) {
        return;
    }

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.chat_response_activity_rebuild;
CREATE TEMP TABLE chat_response_activity_rebuild AS
  SELECT id, response_id, chat_id, sequence, kind, status, title, detail, summary,
         artifact_ids_json, metadata_json, started_at, updated_at, completed_at
  FROM chat_response_activity;
DROP TABLE chat_response_activity;
${CHAT_RESPONSE_ACTIVITY_TABLE};
INSERT INTO chat_response_activity
  (id, response_id, chat_id, sequence, kind, status, title, detail, summary,
   artifact_ids_json, metadata_json, started_at, updated_at, completed_at)
  SELECT id, response_id, chat_id, sequence,
         kind, status, title, detail, summary,
         artifact_ids_json, metadata_json, started_at, updated_at, completed_at
  FROM chat_response_activity_rebuild
  WHERE kind <> 'rich_response';
DROP TABLE temp.chat_response_activity_rebuild;
${CHAT_RESPONSE_ACTIVITY_INDEXES}
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function ensureMemoryJobsSkillReviewKind(db: Database): void {
    const sql = tableSql(db, 'memory_jobs');

    if (!sql || sql.includes("'skill_review'")) {
        return;
    }

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.memory_jobs_rebuild;
CREATE TEMP TABLE memory_jobs_rebuild AS
  SELECT id, kind, status, chat_id, agent_id, agent_participant_id,
         model_category, model_json, source_start_sequence, source_end_sequence,
         output_path, file_changes_json, usage_json, transcript_json,
         metadata_json, error, created_at, updated_at, started_at, completed_at
  FROM memory_jobs;
DROP TABLE memory_jobs;
${MEMORY_JOBS_TABLE};
INSERT INTO memory_jobs
  (id, kind, status, chat_id, agent_id, agent_participant_id,
   model_category, model_json, source_start_sequence, source_end_sequence,
   output_path, file_changes_json, usage_json, transcript_json,
   metadata_json, error, created_at, updated_at, started_at, completed_at)
  SELECT id, kind, status, chat_id, agent_id, agent_participant_id,
         model_category, model_json, source_start_sequence, source_end_sequence,
         output_path, file_changes_json, usage_json, transcript_json,
         metadata_json, error, created_at, updated_at, started_at, completed_at
  FROM memory_jobs_rebuild;
DROP TABLE temp.memory_jobs_rebuild;
${MEMORY_JOBS_INDEXES}
`);
        db.exec('COMMIT');
        transactionOpen = false;
    } catch (error) {
        if (transactionOpen) {
            db.exec('ROLLBACK');
        }
        throw error;
    } finally {
        db.exec('PRAGMA foreign_keys = ON');
    }
}

function tableSql(db: Database, name: string): string | null {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? null;
}

function tableColumns(db: Database, name: string): Set<string> {
    const rows = db.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
}

function columnExpression(columns: Set<string>, column: string, fallback: string): string {
    return columns.has(column) ? column : fallback;
}

function _ensureTableColumn(
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

function hydrateAgentSkillAssignments(db: Database): void {
    if (!(tableSql(db, 'agents') && tableSql(db, 'agent_skill_assignments'))) {
        return;
    }

    const now = new Date().toISOString();
    const rows = db
        .prepare(
            `SELECT id, enabled_skill_ids_json
             FROM agents
             WHERE id NOT IN (
               SELECT DISTINCT agent_id FROM agent_skill_assignments
             )`
        )
        .all() as Array<{ enabled_skill_ids_json: string; id: string }>;

    const insert = db.prepare(
        `INSERT OR IGNORE INTO agent_skill_assignments
         (agent_id, skill_id, enabled, created_at, updated_at)
         VALUES ($agentId, $skillId, 1, $now, $now)`
    );

    for (const row of rows) {
        for (const skillId of parseStringArray(row.enabled_skill_ids_json)) {
            insert.run({ $agentId: row.id, $now: now, $skillId: skillId });
        }
    }
}

function hydrateDefaultHostToolGrants(db: Database): void {
    if (
        !(
            tableSql(db, 'agents') &&
            tableSql(db, 'agent_host_tool_grants') &&
            tableSql(db, 'runtime_metadata')
        )
    ) {
        return;
    }
    const migrationKey = 'host_tool_defaults_seeded';
    const migrated = db
        .prepare('SELECT 1 FROM runtime_metadata WHERE key = $key')
        .get({ $key: migrationKey });
    if (migrated) {
        return;
    }
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare(
            `INSERT OR IGNORE INTO agent_host_tool_grants
             (agent_id, tool_id, created_at, updated_at)
             SELECT id, 'web_fetch', $now, $now FROM agents`
        ).run({ $now: now });
        db.prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, '1', $now)`
        ).run({ $key: migrationKey, $now: now });
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function parseStringArray(value: string): string[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
            return parsed.filter((entry): entry is string => typeof entry === 'string');
        }
    } catch {
        return [];
    }

    return [];
}
