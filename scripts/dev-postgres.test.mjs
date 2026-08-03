import assert from 'node:assert/strict';
import test from 'node:test';
import { stopStaleDevPostgres } from './dev-postgres.mjs';

test('stopStaleDevPostgres stops the postmaster for the managed data root', () => {
    const calls = [];
    const environment = {
        GROTTO_POSTGRES_DATA_ROOT: '/managed/postgres',
    };

    const cleanupCount = stopStaleDevPostgres(environment, {
        binaries: { pgCtl: '/postgres/bin/pg_ctl' },
        fileSystem: {
            existsSync: (filePath) => filePath === '/managed/postgres/postmaster.pid',
        },
        spawnCommand: (command, args, options) => {
            calls.push({ args, command, options });
            return { status: 0 };
        },
    });

    assert.equal(cleanupCount, 1);
    assert.deepEqual(calls, [
        {
            args: ['--pgdata', '/managed/postgres', 'status'],
            command: '/postgres/bin/pg_ctl',
            options: { encoding: 'utf8' },
        },
        {
            args: ['--pgdata', '/managed/postgres', '--mode', 'fast', '--wait', 'stop'],
            command: '/postgres/bin/pg_ctl',
            options: { encoding: 'utf8' },
        },
    ]);
});

test('stopStaleDevPostgres is a no-op without a postmaster', () => {
    const cleanupCount = stopStaleDevPostgres(
        { GROTTO_POSTGRES_DATA_ROOT: '/managed/postgres' },
        {
            fileSystem: { existsSync: () => false },
            spawnCommand: () => {
                throw new Error('should not spawn');
            },
        }
    );

    assert.equal(cleanupCount, 0);
});

test('stopStaleDevPostgres leaves a dead postmaster lock for PostgreSQL recovery', () => {
    const calls = [];
    const cleanupCount = stopStaleDevPostgres(
        { GROTTO_POSTGRES_DATA_ROOT: '/managed/postgres' },
        {
            binaries: { pgCtl: '/postgres/bin/pg_ctl' },
            fileSystem: { existsSync: () => true },
            spawnCommand: (_command, args) => {
                calls.push(args);
                return { status: 3 };
            },
        }
    );

    assert.equal(cleanupCount, 0);
    assert.deepEqual(calls, [['--pgdata', '/managed/postgres', 'status']]);
});
