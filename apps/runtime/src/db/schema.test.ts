import { afterEach, describe, expect, it } from 'vitest';
import { createAgentTurn } from '../tavern/agent-turn-store';
import {
    createChat,
    getResponseActivity,
    upsertResponse,
    upsertResponseActivity,
} from '../tavern/chat-api';
import { closeDb, initTestDb } from './connection';
import { ensureRuntimeSchema } from './schema';
import type { Database } from './sqlite';

describe('Runtime DB schema repairs', () => {
    afterEach(() => {
        closeDb();
    });

    it('repairs response activity kind constraints to allow widget activity', () => {
        const db = initTestDb();
        createLegacyResponseActivityTable(db);
        db.exec('PRAGMA foreign_keys = OFF');
        db.prepare(
            `INSERT INTO chat_response_activity
             (id, response_id, chat_id, sequence, kind, status, title, artifact_ids_json,
              metadata_json, started_at, updated_at)
             VALUES ($id, $responseId, $chatId, $sequence, $kind, 'completed', $title,
              '[]', '{}', $now, $now)`
        ).run({
            $chatId: 'cht_old',
            $id: 'act_retired',
            $kind: 'rich_response',
            $now: new Date().toISOString(),
            $responseId: 'rsp_old',
            $sequence: 1,
            $title: 'Retired display',
        });
        db.exec('PRAGMA foreign_keys = ON');

        ensureRuntimeSchema(db);
        createChat({ id: 'cht_legacy', title: 'legacy' });
        upsertResponse('cht_legacy', {
            id: 'rsp_legacy',
            participant_id: 'agt_1',
            status: 'running',
        });

        expect(() =>
            upsertResponseActivity('cht_legacy', 'rsp_legacy', {
                id: 'act_widget',
                kind: 'widget',
                status: 'completed',
                title: 'Widget',
            })
        ).not.toThrow();
        expect(getResponseActivity('act_widget')).toMatchObject({
            id: 'act_widget',
            kind: 'widget',
        });
        expect(tableSql(db, 'chat_response_activity')).toContain("'widget'");
        expect(tableSql(db, 'chat_response_activity')).not.toContain("'rich_response'");
        expect(
            db
                .prepare(
                    "SELECT COUNT(*) AS count FROM chat_response_activity WHERE id = 'act_retired'"
                )
                .get()
        ).toMatchObject({ count: 0 });
    });

    it('repairs memory job kind constraints to allow skill review jobs', () => {
        const db = initTestDb();
        createLegacyMemoryJobsTable(db);
        db.exec('PRAGMA foreign_keys = OFF');
        db.prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, agent_id, file_changes_json, usage_json,
                transcript_json, metadata_json, created_at, updated_at
             )
             VALUES (
                'memjob_old', 'extraction', 'completed', 'agt_1', '[]', '{}',
                '[]', '{"kept":true}', '2026-07-02T20:00:00.000Z',
                '2026-07-02T20:00:00.000Z'
             )`
        ).run();
        db.exec('PRAGMA foreign_keys = ON');

        ensureRuntimeSchema(db);
        db.prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, agent_id, file_changes_json, usage_json,
                transcript_json, metadata_json, created_at, updated_at
             )
             VALUES (
                'memjob_review', 'skill_review', 'completed', 'agt_1', '[]', '{}',
                '[]', '{}', '2026-07-02T20:01:00.000Z',
                '2026-07-02T20:01:00.000Z'
             )`
        ).run();

        expect(tableSql(db, 'memory_jobs')).toContain("'skill_review'");
        expect(tableSql(db, 'memory_jobs')).toContain("'curation'");
        expect(
            db.prepare('SELECT id, kind, metadata_json FROM memory_jobs ORDER BY id ASC').all()
        ).toEqual([
            {
                id: 'memjob_old',
                kind: 'extraction',
                metadata_json: '{"kept":true}',
            },
            {
                id: 'memjob_review',
                kind: 'skill_review',
                metadata_json: '{}',
            },
        ]);
    });

    it('repairs chat kind constraints to allow task chats', () => {
        const db = initTestDb();
        createLegacyChatsTable(db);

        ensureRuntimeSchema(db);
        createChat({ id: 'cht_task', kind: 'task', title: 'T-1: Fix it' });

        expect(tableSql(db, 'chats')).toContain("'task'");
        expect(db.prepare("SELECT kind FROM chats WHERE id = 'cht_task'").get()).toEqual({
            kind: 'task',
        });
    });

    it('repairs chat kind constraints to allow thread chats on upgraded databases', () => {
        const db = initTestDb();
        // Pre-thread era: 'task' is already present, so only the missing
        // 'thread' kind (and the parent/anchor columns) triggers the rebuild.
        db.exec(`
CREATE TABLE chats (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm', 'task')),
  title                 TEXT,
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);
INSERT INTO chats (id, kind, created_at, updated_at)
  VALUES ('cht_existing', 'channel', '2026-01-01', '2026-01-01');
`);

        ensureRuntimeSchema(db);

        expect(tableSql(db, 'chats')).toContain("'thread'");
        expect(() =>
            db
                .prepare(
                    `INSERT INTO chats
                     (id, kind, parent_chat_id, anchor_message_id, created_at, updated_at)
                     VALUES ('cht_thr_x', 'thread', 'cht_existing', 'msg_x',
                             '2026-01-02', '2026-01-02')`
                )
                .run()
        ).not.toThrow();
        expect(db.prepare("SELECT kind FROM chats WHERE id = 'cht_existing'").get()).toEqual({
            kind: 'channel',
        });
    });

    it('adds followed state to existing thread follow records', () => {
        const db = initTestDb();
        db.exec(`
CREATE TABLE thread_follows (
  thread_chat_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (thread_chat_id, participant_id)
);
INSERT INTO thread_follows (thread_chat_id, participant_id, created_at)
  VALUES ('cht_thr_existing', 'agt_existing', '2026-07-21T12:00:00.000Z');
`);

        ensureRuntimeSchema(db);

        expect(
            db
                .prepare(
                    `SELECT thread_chat_id, participant_id, followed, created_at
                     FROM thread_follows`
                )
                .get()
        ).toEqual({
            created_at: '2026-07-21T12:00:00.000Z',
            followed: 1,
            participant_id: 'agt_existing',
            thread_chat_id: 'cht_thr_existing',
        });
    });

    it('repairs legacy chat-scoped agent turns for global-session delivery', () => {
        const db = initTestDb();
        ensureRuntimeSchema(db);
        db.prepare(
            `INSERT INTO agents (
                id, name, workspace_folder, raw_json, last_synced_at, created_at, updated_at
             )
             VALUES ('agt_old', 'Old', 'old', '{}', '2026-07-17', '2026-07-17', '2026-07-17')`
        ).run();
        db.prepare(
            `INSERT INTO agent_sessions (
                id, agent_id, generation, effective_model_json, status, created_at, updated_at
             )
             VALUES (
                'ags_old', 'agt_old', 1, '{"provider":"codex","model":"gpt-5.5"}',
                'active', '2026-07-17', '2026-07-17'
             )`
        ).run();
        replaceAgentTurnsWithLegacyTable(db);

        ensureRuntimeSchema(db);

        expect(tableSql(db, 'agent_turns')).toContain("'start', 'drain'");
        expect(tableSql(db, 'agent_turns')).not.toContain('chat_id');
        expect(
            db
                .prepare(
                    `SELECT id, agent_id, agent_session_id, kind, status, metadata_json
                     FROM agent_turns WHERE id = 'run_old'`
                )
                .get()
        ).toEqual({
            agent_id: 'agt_old',
            agent_session_id: 'ags_old',
            id: 'run_old',
            kind: 'drain',
            metadata_json: '{"kept":true}',
            status: 'completed',
        });
        expect(() =>
            createAgentTurn(
                {
                    agentId: 'agt_old',
                    agentSessionId: 'ags_old',
                    id: 'run_new',
                    kind: 'drain',
                },
                db
            )
        ).not.toThrow();
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    });

    it('creates the WS5 task, reminder, reaction, and attachment tables', () => {
        const db = initTestDb();
        ensureRuntimeSchema(db);

        for (const table of [
            'message_tasks',
            'labels',
            'reminders',
            'reminder_runs',
            'message_reactions',
            'attachments',
        ]) {
            expect(tableSql(db, table), table).not.toBe('');
        }
        // The pre-flip tracker and cron product tables are retired; fresh
        // databases must not recreate them (live databases drop them at the
        // WS5 manual cutover).
        for (const table of [
            'tasks',
            'task_dependencies',
            'task_labels',
            'task_attachments',
            'cron_jobs',
            'cron_runs',
        ]) {
            expect(tableSql(db, table), table).toBe('');
        }
    });
});

function createLegacyResponseActivityTable(db: Database) {
    db.exec(`
CREATE TABLE chat_response_activity (
  id             TEXT PRIMARY KEY,
  response_id    TEXT NOT NULL,
  chat_id        TEXT NOT NULL,
  sequence       INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('reasoning', 'tool_call', 'tool_result', 'command', 'message', 'artifact', 'rich_response', 'custom')),
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
`);
}

function createLegacyMemoryJobsTable(db: Database) {
    db.exec(`
CREATE TABLE memory_jobs (
  id                     TEXT PRIMARY KEY,
  kind                   TEXT NOT NULL CHECK (kind IN ('extraction', 'dream')),
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
`);
}

function createLegacyChatsTable(db: Database) {
    db.exec(`
CREATE TABLE chats (
  id                    TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL DEFAULT 'channel' CHECK (kind IN ('channel', 'dm')),
  title                 TEXT,
  pinned                INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  metadata_json         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0
);
`);
}

function replaceAgentTurnsWithLegacyTable(db: Database) {
    db.exec(`
PRAGMA foreign_keys = OFF;
DROP TABLE agent_turns;
CREATE TABLE agent_turns (
  id                      TEXT PRIMARY KEY,
  chat_id                 TEXT NOT NULL,
  agent_session_id        TEXT NOT NULL,
  agent_participant_id    TEXT NOT NULL,
  agent_id                TEXT NOT NULL,
  trigger_message_id      TEXT NOT NULL,
  response_id             TEXT NOT NULL,
  status                  TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempt                 INTEGER NOT NULL CHECK (attempt > 0),
  output_message_ids_json TEXT NOT NULL DEFAULT '[]',
  activity_ids_json       TEXT NOT NULL DEFAULT '[]',
  metadata_json           TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  started_at              TEXT,
  completed_at            TEXT
);
INSERT INTO agent_turns (
  id, chat_id, agent_session_id, agent_participant_id, agent_id,
  trigger_message_id, response_id, status, attempt, metadata_json,
  created_at, updated_at, started_at, completed_at
) VALUES (
  'run_old', 'cht_old', 'ags_old', 'agt_old', 'agt_old',
  'msg_old', 'rsp_old', 'completed', 1, '{"kept":true}',
  '2026-07-17', '2026-07-17', '2026-07-17', '2026-07-17'
);
PRAGMA foreign_keys = ON;
`);
}

function tableSql(db: Database, name: string) {
    const row = db
        .prepare('SELECT sql FROM sqlite_master WHERE type = $type AND name = $name')
        .get({ $name: name, $type: 'table' }) as { sql: string } | null;

    return row?.sql ?? '';
}
