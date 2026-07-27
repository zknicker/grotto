import { afterAll, beforeAll, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQL } from 'bun';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let admin: SQL;
let cluster: PostgresCluster;
let root: string;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    admin = new SQL(cluster.databaseUrl);
    await admin`
        INSERT INTO users (id, clerk_user_id)
        VALUES ('usr_restore', 'clerk_restore')
    `;
    root = mkdtempSync(join(tmpdir(), 'grotto-restore-test-'));
});

afterAll(async () => {
    await admin.close();
    await cluster.stop();
    rmSync(root, { force: true, recursive: true });
});

test('restores PostgreSQL and the attachment sentinel into isolated state', async () => {
    const attachments = join(root, 'production-attachments');
    const repository = join(root, 'repository');
    const restic = createFakeRestic(root);
    const restoreRoot = join(root, 'isolated-restore');
    mkdirSync(attachments);
    writeFileSync(join(attachments, '.backup-sentinel'), 'grotto-attachments-v1\n');
    await runBackup({ attachments, repository, restic });

    const restoreDatabaseName = 'grotto_restore_test';
    await admin.unsafe(`CREATE DATABASE ${restoreDatabaseName}`);
    const restoreDatabaseUrl = new URL(cluster.databaseUrl);
    restoreDatabaseUrl.pathname = `/${restoreDatabaseName}`;

    const restore = Bun.spawn([Bun.which('bun') ?? 'bun', 'src/grotto-server-restore.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
            ...process.env,
            GROTTO_ATTACHMENT_ROOT: attachments,
            GROTTO_PG_RESTORE_COMMAND: postgresBinary('pg_restore'),
            GROTTO_PRODUCTION_DATABASE_URL: cluster.databaseUrl,
            GROTTO_RESTIC_COMMAND: restic,
            GROTTO_RESTORE_DATABASE_URL: restoreDatabaseUrl.toString(),
            GROTTO_RESTORE_SNAPSHOT: 'latest',
            GROTTO_RESTORE_TARGET_ROOT: restoreRoot,
            RESTIC_PASSWORD_FILE: join(root, 'restic-password'),
            RESTIC_REPOSITORY: repository,
            TEST_RESTIC_REPOSITORY: repository,
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        restore.exited,
        new Response(restore.stdout).text(),
        new Response(restore.stderr).text(),
    ]);
    if (exitCode !== 0) {
        throw new Error(`Restore command failed: ${stderr}`);
    }

    const restored = new SQL(restoreDatabaseUrl.toString());
    try {
        const users = (await restored`SELECT clerk_user_id FROM users`) as {
            clerk_user_id: string;
        }[];
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual({ status: 'ok' });
        expect(stderr).toBe('');
        expect(users).toEqual([{ clerk_user_id: 'clerk_restore' }]);
        expect(readFileSync(join(restoreRoot, 'attachments', '.backup-sentinel'), 'utf8')).toBe(
            'grotto-attachments-v1\n'
        );
    } finally {
        await restored.close();
    }
});

test('refuses a restore aimed at the production database', async () => {
    const restore = Bun.spawn([Bun.which('bun') ?? 'bun', 'src/grotto-server-restore.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
            ...process.env,
            GROTTO_ATTACHMENT_ROOT: join(root, 'production-attachments'),
            GROTTO_PRODUCTION_DATABASE_URL: cluster.databaseUrl,
            GROTTO_RESTORE_DATABASE_URL: cluster.databaseUrl,
            GROTTO_RESTORE_SNAPSHOT: 'latest',
            GROTTO_RESTORE_TARGET_ROOT: join(root, 'refused-restore'),
            RESTIC_PASSWORD_FILE: join(root, 'restic-password'),
            RESTIC_REPOSITORY: join(root, 'repository'),
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        restore.exited,
        new Response(restore.stdout).text(),
        new Response(restore.stderr).text(),
    ]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(JSON.parse(stderr)).toEqual({
        code: 'restore_target_refused',
        status: 'error',
    });
});

async function runBackup(options: { attachments: string; repository: string; restic: string }) {
    const backup = Bun.spawn([Bun.which('bun') ?? 'bun', 'src/grotto-server-backup.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
            ...process.env,
            GROTTO_ATTACHMENT_ROOT: options.attachments,
            GROTTO_BACKUP_STAGING_ROOT: join(root, 'staging'),
            GROTTO_BACKUP_SUCCESS_FILE: join(root, 'last-success'),
            GROTTO_DATABASE_URL: cluster.databaseUrl,
            GROTTO_PG_DUMP_COMMAND: postgresBinary('pg_dump'),
            GROTTO_RESTIC_COMMAND: options.restic,
            RESTIC_PASSWORD_FILE: join(root, 'restic-password'),
            RESTIC_REPOSITORY: options.repository,
            TEST_RESTIC_REPOSITORY: options.repository,
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    expect(await backup.exited).toBe(0);
}

function createFakeRestic(directory: string) {
    const path = join(directory, 'restic');
    writeFileSync(
        path,
        `#!/bin/sh
set -eu
case "$1" in
  backup)
    mkdir -p "$RESTIC_REPOSITORY/snapshot"
    cp -R . "$RESTIC_REPOSITORY/snapshot/"
    ;;
  forget)
    ;;
  restore)
    test -z "\${GROTTO_PRODUCTION_DATABASE_URL:-}"
    test -z "\${GROTTO_RESTORE_DATABASE_URL:-}"
    shift 2
    test "$1" = "--target"
    mkdir -p "$2"
    cp -R "$RESTIC_REPOSITORY/snapshot/." "$2/"
    ;;
  *)
    exit 2
    ;;
esac
`
    );
    chmodSync(path, 0o700);
    return path;
}

function postgresBinary(name: string) {
    return join(process.env.GROTTO_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@16/bin', name);
}
