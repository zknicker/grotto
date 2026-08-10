import { expect, test } from 'bun:test';
import {
    migrateProductionDatabase,
    readMigrationConfig,
} from '../src/grotto-production-migrations.ts';

test('runs the candidate release migration with only its scoped configuration', async () => {
    let invocation: { binary: string; env: Record<string, string> } | undefined;

    await migrateProductionDatabase('/srv/releases/revision', {
        execute: (binary, env) => {
            invocation = { binary, env };
        },
        exists: () => Promise.resolve(true),
        inspect: () => Promise.resolve({ mode: 0o10_0600, uid: 0 }),
        readConfig: () =>
            Promise.resolve(
                '# root-readable\nGROTTO_DATABASE_MIGRATION_URL=postgres://migrator:secret@db/grotto\n' +
                    'GROTTO_DATABASE_RUNTIME_ROLE=grotto_runtime\n' +
                    'GROTTO_DATABASE_BACKUP_ROLE=grotto_backup\n'
            ),
    });

    expect(invocation).toEqual({
        binary: '/srv/releases/revision/bin/grotto-server-migrate',
        env: {
            GROTTO_DATABASE_BACKUP_ROLE: 'grotto_backup',
            GROTTO_DATABASE_MIGRATION_URL: 'postgres://migrator:secret@db/grotto',
            GROTTO_DATABASE_RUNTIME_ROLE: 'grotto_runtime',
            GROTTO_MIGRATIONS_FOLDER: '/srv/releases/revision/share/grotto-server/migrations',
        },
    });
});

test('requires exactly one value for every migration credential', () => {
    expect(() => readMigrationConfig('')).toThrow('exactly once');
    expect(() =>
        readMigrationConfig(
            'GROTTO_DATABASE_MIGRATION_URL=postgres://one\nGROTTO_DATABASE_MIGRATION_URL=postgres://two'
        )
    ).toThrow('exactly once');
});

test('allows activation of a release from before migrations existed', async () => {
    await expect(
        migrateProductionDatabase('/srv/releases/legacy', {
            exists: () => Promise.resolve(false),
            readConfig: () => Promise.reject(new Error('must not read migration credentials')),
        })
    ).resolves.toBeUndefined();
});
