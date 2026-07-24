import type { Database } from './sqlite.ts';

const AGENT_TURNS_TABLE = `
CREATE TABLE agent_turns (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  agent_session_id TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('start', 'drain')),
  status           TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  metadata_json    TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  started_at       TEXT,
  completed_at     TEXT,
  FOREIGN KEY(agent_session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
)`;

const AGENT_TURNS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_agent_turns_session_status
  ON agent_turns(agent_session_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_turns_agent_created
  ON agent_turns(agent_id, created_at);
`;

/**
 * Rebuilds the retired chat-scoped turn table into the agent-global turn shape.
 * Legacy turns all represent delivered chat work, so their equivalent kind is
 * `drain`; ids and execution evidence stay intact for activity history.
 */
export function repairAgentTurnShape(db: Database): void {
    const columns = tableColumns(db, 'agent_turns');
    if (columns.size === 0 || columns.has('kind')) {
        return;
    }

    let transactionOpen = false;
    db.exec('PRAGMA foreign_keys = OFF');
    try {
        db.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        db.exec(`
DROP TABLE IF EXISTS temp.agent_turns_rebuild;
CREATE TEMP TABLE agent_turns_rebuild AS
  SELECT id, agent_id, agent_session_id, 'drain' AS kind, status,
         metadata_json, created_at, updated_at, started_at, completed_at
  FROM agent_turns;
DROP TABLE agent_turns;
${AGENT_TURNS_TABLE};
INSERT INTO agent_turns
  (id, agent_id, agent_session_id, kind, status, metadata_json,
   created_at, updated_at, started_at, completed_at)
  SELECT id, agent_id, agent_session_id, kind, status, metadata_json,
         created_at, updated_at, started_at, completed_at
  FROM agent_turns_rebuild;
DROP TABLE temp.agent_turns_rebuild;
${AGENT_TURNS_INDEXES}
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

function tableColumns(db: Database, name: string): Set<string> {
    const rows = db.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
}
