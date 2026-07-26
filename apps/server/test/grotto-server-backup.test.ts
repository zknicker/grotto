import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SQL } from 'bun';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let cluster: PostgresCluster;
let root: string;
let sql: SQL;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    sql = new SQL(cluster.databaseUrl);
    await sql`
        INSERT INTO users (id, clerk_user_id)
        VALUES ('usr_backup', 'clerk_backup')
    `;
    root = mkdtempSync(join(tmpdir(), 'grotto-backup-test-'));
});

afterAll(async () => {
    await sql.close();
    await cluster.stop();
    rmSync(root, { force: true, recursive: true });
});

test('uploads PostgreSQL and the attachment sentinel before recording success', async () => {
    const attachments = join(root, 'attachments');
    const repository = join(root, 'repository');
    const staging = join(root, 'staging');
    const successFile = join(root, 'last-success');
    const restic = createFakeRestic(root);
    mkdirSync(attachments);
    await Bun.write(join(attachments, '.backup-sentinel'), 'grotto-attachments-v1\n');

    const backup = Bun.spawn([Bun.which('bun') ?? 'bun', 'src/grotto-server-backup.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
            ...process.env,
            GROTTO_ATTACHMENT_ROOT: attachments,
            GROTTO_BACKUP_STAGING_ROOT: staging,
            GROTTO_BACKUP_SUCCESS_FILE: successFile,
            GROTTO_DATABASE_URL: cluster.databaseUrl,
            GROTTO_PG_DUMP_COMMAND: postgresBinary('pg_dump'),
            GROTTO_RESTIC_COMMAND: restic,
            RESTIC_PASSWORD_FILE: join(root, 'restic-password'),
            RESTIC_REPOSITORY: repository,
            TEST_RESTIC_REPOSITORY: repository,
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        backup.exited,
        new Response(backup.stdout).text(),
        new Response(backup.stderr).text(),
    ]);

    if (exitCode !== 0) {
        throw new Error(`Backup command failed: ${stderr}`);
    }

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ status: 'ok' });
    expect(stderr).toBe('');
    expect(existsSync(join(repository, 'snapshot', 'database.dump'))).toBe(true);
    expect(
        readFileSync(join(repository, 'snapshot', 'attachments', '.backup-sentinel'), 'utf8')
    ).toBe('grotto-attachments-v1\n');
    expect(readFileSync(successFile, 'utf8')).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
});

test('removes plaintext staging without recording success when upload fails', async () => {
    const attachments = join(root, 'failed-attachments');
    const staging = join(root, 'failed-staging');
    const successFile = join(root, 'failed-success');
    const repository = join(root, 'failed-repository-secret');
    const restic = join(root, 'failing-restic');
    mkdirSync(attachments);
    writeFileSync(join(attachments, '.backup-sentinel'), 'grotto-attachments-v1\n');
    writeFileSync(
        restic,
        '#!/bin/sh\nprintf "repository %s unavailable\\n" "$RESTIC_REPOSITORY" >&2\nexit 1\n'
    );
    chmodSync(restic, 0o700);

    const backup = Bun.spawn([Bun.which('bun') ?? 'bun', 'src/grotto-server-backup.ts'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: {
            ...process.env,
            GROTTO_ATTACHMENT_ROOT: attachments,
            GROTTO_BACKUP_STAGING_ROOT: staging,
            GROTTO_BACKUP_SUCCESS_FILE: successFile,
            GROTTO_DATABASE_URL: cluster.databaseUrl,
            GROTTO_PG_DUMP_COMMAND: postgresBinary('pg_dump'),
            GROTTO_RESTIC_COMMAND: restic,
            RESTIC_PASSWORD_FILE: join(root, 'restic-password'),
            RESTIC_REPOSITORY: repository,
        },
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        backup.exited,
        new Response(backup.stdout).text(),
        new Response(backup.stderr).text(),
    ]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    const error = JSON.parse(stderr);
    expect(error.code).toBe('backup_failed');
    expect(error.reason).toContain('repository [redacted] unavailable');
    expect(stderr).not.toContain(repository);
    expect(existsSync(successFile)).toBe(false);
    expect(readdirSync(staging)).toEqual([]);
});

function createFakeRestic(directory: string) {
    const path = join(directory, 'restic');
    writeFileSync(
        path,
        `#!/bin/sh
set -eu
case "$1" in
  backup)
    test -z "\${GROTTO_DATABASE_URL:-}"
    mkdir -p "$RESTIC_REPOSITORY/snapshot"
    cp -R . "$RESTIC_REPOSITORY/snapshot/"
    ;;
  forget)
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
