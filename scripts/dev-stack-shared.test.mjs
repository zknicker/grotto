import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveDevPorts } from './dev-ports.mjs';
import {
    cleanupStaleProcesses,
    createDevStackEnvironment,
    formatPortBlockers,
} from './dev-stack-shared.mjs';

test('formatPortBlockers includes owner process details', () => {
    const repositoryRoot = path.join('/Users', 'zknicker', 'repo');
    const message = formatPortBlockers(
        [
            {
                command: 'bun --watch src/index.ts',
                cwd: path.join('/Users', 'zknicker', 'repo', 'apps', 'runtime'),
                label: 'runtime',
                pid: 1234,
                port: 18_790,
            },
        ],
        repositoryRoot
    );

    assert.match(message, /Required dev port unavailable/u);
    assert.match(message, /runtime port 18790 is already in use by PID 1234/u);
    assert.match(message, /bun --watch src\/index\.ts/u);
    assert.match(message, /\.\/apps\/runtime/u);
});

test('createDevStackEnvironment uses shared dev state outside packaged app state', () => {
    const ports = resolveDevPorts({
        baseEnvironment: {
            TAVERN_DEV_PORT_BASE: '42000',
            TAVERN_DEV_STACK_ID: 'alpha',
        },
        repositoryRoot: '/repo/tavern',
    });
    const environment = createDevStackEnvironment({
        baseEnvironment: {
            PATH: '/usr/bin',
            TAVERN_DEV_PORT_BASE: '42000',
            TAVERN_DEV_STACK_ID: 'alpha',
        },
        ports,
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.PATH, '/usr/bin');
    assert.equal(
        environment.GROTTO_COMPUTER_DATA_ROOT,
        path.join(os.homedir(), '.tavern', 'dev', 'alpha', 'computer')
    );
    assert.equal(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern', 'dev', 'alpha', 'tavern.sqlite')
    );
    assert.equal(environment.TAVERN_SERVER_PORT, '42001');
    assert.equal(environment.TAVERN_WEBSITE_PORT, '42000');
    assert.equal(environment.TAVERN_DEV_STACK, '1');
    assert.notEqual(environment.DATABASE_PATH, path.join(os.homedir(), '.tavern', 'tavern.sqlite'));
    assert.notEqual(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern', 'dev', 'tavern.sqlite')
    );
});

test('resolveDevPorts derives different default port groups for different worktrees', () => {
    const left = resolveDevPorts({ repositoryRoot: '/repo/worktree-left/tavern' });
    const right = resolveDevPorts({ repositoryRoot: '/repo/worktree-right/tavern' });

    assert.notDeepEqual(left, right);
    assert.equal(Number(left.serverPort), Number(left.websitePort) + 1);
    assert.equal(Number(left.runtimePort), Number(left.websitePort) + 2);
});

test('resolveDevPorts derives shared default ports from an explicit stack id', () => {
    const baseEnvironment = { TAVERN_DEV_STACK_ID: 'tavern-shared' };
    const left = resolveDevPorts({
        baseEnvironment,
        repositoryRoot: '/repo/worktree-left/tavern',
    });
    const right = resolveDevPorts({
        baseEnvironment,
        repositoryRoot: '/repo/worktree-right/tavern',
    });

    assert.deepEqual(left, right);
    assert.equal(Number(left.serverPort), Number(left.websitePort) + 1);
    assert.equal(Number(left.runtimePort), Number(left.websitePort) + 2);
});

test('createDevStackEnvironment preserves explicit state overrides', () => {
    const environment = createDevStackEnvironment({
        baseEnvironment: {
            DATABASE_PATH: '/tmp/tavern.sqlite',
        },
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.DATABASE_PATH, '/tmp/tavern.sqlite');
});

test('cleanupStaleProcesses closes the old Tauri desktop app in desktop mode', () => {
    const killedProcesses = [];
    const cleanupCount = cleanupStaleProcesses({
        mode: 'desktop',
        ports: {
            serverPort: 8080,
            websitePort: 3100,
        },
        processTools: {
            killProcess: (pid, signal) => {
                killedProcesses.push([pid, signal]);
            },
            listListeningProcessIds: (port) => (port === 3180 ? [222] : []),
            readProcessCommand: (pid) =>
                pid === 222
                    ? '/Applications/Grotto.app/Contents/MacOS/grotto-server --app-origin tauri://localhost --server-port 3180'
                    : '',
            readProcessParentId: (pid) => (pid === 222 ? 111 : null),
            readProcessWorkingDirectory: () => null,
            waitForProcessExit: () => undefined,
        },
        repositoryRoot: '/repo',
    });

    assert.equal(cleanupCount, 2);
    assert.deepEqual(killedProcesses, [
        [222, 'SIGTERM'],
        [111, 'SIGTERM'],
    ]);
});
