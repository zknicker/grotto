import { Database } from 'bun:sqlite';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getTableName, isTable } from 'drizzle-orm';
import * as schemaTables from './schema.ts';

const directory = mkdtempSync(join(tmpdir(), 'tavern-db-bootstrap-'));
process.env.DATABASE_PATH = join(directory, 'bootstrap-test.sqlite');

async function withTempDatabase(run: (db: Database) => Promise<void> | void) {
    const directory = mkdtempSync(join(tmpdir(), 'tavern-db-'));
    const path = join(directory, 'test.sqlite');
    const db = new Database(path);

    try {
        await run(db);
    } finally {
        db.close();
        rmSync(directory, { force: true, recursive: true });
    }
}

function listTableColumns(db: Database, table: string) {
    return db.query(`PRAGMA table_info(${table});`).all() as Array<{ name: string }>;
}

function listSortedColumnNames(db: Database, table: string) {
    return listTableColumns(db, table)
        .map((column) => column.name)
        .sort((left, right) => left.localeCompare(right));
}

function listUserTables(db: Database) {
    return db
        .query(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'
               AND name NOT LIKE 'sqlite_%'
             ORDER BY name;`
        )
        .all() as Array<{ name: string }>;
}

function listExpectedSchemaTables() {
    return Object.values(schemaTables)
        .filter((value) => isTable(value))
        .map((table) => getTableName(table as Parameters<typeof getTableName>[0]))
        .sort((left, right) => left.localeCompare(right));
}

async function runBootstrapAgainst(db: Database) {
    const originalExec = Database.prototype.exec;
    const originalQuery = Database.prototype.query;

    try {
        Database.prototype.exec = function exec(
            this: Database,
            sql: string,
            ...bindings: unknown[]
        ) {
            return Reflect.apply(originalExec as (...args: unknown[]) => unknown, db, [
                sql,
                ...bindings,
            ]);
        } as typeof Database.prototype.exec;
        Database.prototype.query = function query(
            this: Database,
            sql: string,
            ...bindings: unknown[]
        ) {
            return Reflect.apply(originalQuery as (...args: unknown[]) => unknown, db, [
                sql,
                ...bindings,
            ]);
        } as typeof Database.prototype.query;

        const { ensureDatabaseSchema } = await import('./bootstrap.ts');
        ensureDatabaseSchema();
    } finally {
        Database.prototype.exec = originalExec;
        Database.prototype.query = originalQuery;
    }
}

test('ensureDatabaseSchema creates the current Tavern schema without obsolete tables', async () => {
    await withTempDatabase(async (db) => {
        await runBootstrapAgainst(db);

        const tables = listUserTables(db);
        const actualTableNames: string[] = tables.map((table) => table.name);
        const expectedTableNames = listExpectedSchemaTables();

        assert.deepEqual(actualTableNames, expectedTableNames);
        assert.equal(actualTableNames.includes('channels'), false);
        assert.equal(actualTableNames.includes('agent_channels'), false);
        assert.equal(actualTableNames.includes('channels_sync_state'), false);
        assert.equal(actualTableNames.includes('agent_channels_sync_state'), false);
        assert.equal(actualTableNames.includes('chat_projection_sync_state'), false);
        assert.equal(actualTableNames.includes('cron_job_runs'), false);
        assert.equal(actualTableNames.includes('chats'), false);
        assert.equal(actualTableNames.includes('observed_chats'), false);
        assert.equal(actualTableNames.includes('agent_chat_bindings'), false);
        assert.equal(actualTableNames.includes('agents'), true);
        assert.equal(actualTableNames.includes('chat_sessions'), false);
        assert.equal(actualTableNames.includes('chat_participants'), false);
        assert.equal(actualTableNames.includes('chat_push_state'), false);
        assert.equal(actualTableNames.includes('chats_sync_state'), false);
        assert.equal(actualTableNames.includes('observed_sessions'), false);
        assert.equal(actualTableNames.includes('observed_session_messages'), false);
        assert.equal(actualTableNames.includes('session_sync_state'), false);

        assert.deepEqual(
            listSortedColumnNames(db, 'agent_profiles'),
            [
                'agent_id',
                'created_at',
                'primary_color',
                'runtime_id',
                'updated_at',
                'user_instructions',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'agents'),
            [
                'created_at',
                'enabled_skill_ids_json',
                'id',
                'last_synced_at',
                'name',
                'primary_color',
                'raw_json',
                'runtime_id',
                'updated_at',
                'workspace_folder',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.deepEqual(
            listSortedColumnNames(db, 'session_deliveries'),
            [
                'child_session_key',
                'created_at',
                'cron_job_id',
                'delivered_at',
                'delivery_channel',
                'delivery_target',
                'id',
                'mode',
                'parent_session_key',
                'payload_json',
                'run_id',
                'source_message_id',
                'stats_json',
                'status',
                'stream_log_path',
                'target_message_id',
                'transcript_path',
                'updated_at',
            ].sort((left, right) => left.localeCompare(right))
        );
        assert.equal(actualTableNames.includes('cron_jobs'), false);
        assert.equal(actualTableNames.includes('cron_runs'), false);
        assert.equal(actualTableNames.includes('tasks'), false);
    });
});
