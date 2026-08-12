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

test('formatPortBlockers includes current Server process details', () => {
    const repositoryRoot = path.join('/Users', 'zknicker', 'repo');
    const message = formatPortBlockers(
        [
            {
                command: 'bun --watch src/grotto-server.ts',
                cwd: path.join(repositoryRoot, 'apps', 'server'),
                label: 'Grotto Server',
                pid: 1234,
                port: 8090,
            },
        ],
        repositoryRoot
    );

    assert.match(message, /Grotto Server port 8090 is already in use by PID 1234/u);
    assert.match(message, /\.\/apps\/server/u);
});

test('createDevStackEnvironment uses isolated current-product state', () => {
    const ports = resolveDevPorts({
        baseEnvironment: { TAVERN_DEV_PORT_BASE: '42000', TAVERN_DEV_STACK_ID: 'alpha' },
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
        environment.GROTTO_POSTGRES_DATA_ROOT,
        path.join(os.homedir(), '.tavern', 'dev', 'alpha', 'postgres')
    );
    assert.equal(environment.GROTTO_SERVER_PORT, '42003');
    assert.equal(environment.TAVERN_WEBSITE_PORT, '42000');
    assert.equal(environment.TAVERN_DEV_STACK, '1');
    assert.equal(environment.TAVERN_RUNTIME_PORT, undefined);
    assert.equal(environment.TAVERN_SERVER_PORT, undefined);
});

test('resolveDevPorts derives different groups for different worktrees', () => {
    const left = resolveDevPorts({ repositoryRoot: '/repo/worktree-left/tavern' });
    const right = resolveDevPorts({ repositoryRoot: '/repo/worktree-right/tavern' });

    assert.notDeepEqual(left, right);
    assert.equal(Number(left.grottoPort), Number(left.websitePort) + 3);
});

test('resolveDevPorts shares ports for an explicit stack id', () => {
    const baseEnvironment = { TAVERN_DEV_STACK_ID: 'tavern-shared' };
    const left = resolveDevPorts({ baseEnvironment, repositoryRoot: '/repo/left' });
    const right = resolveDevPorts({ baseEnvironment, repositoryRoot: '/repo/right' });

    assert.deepEqual(left, right);
});

test('cleanupStaleProcesses closes an orphaned Grotto Server watcher', () => {
    const repositoryRoot = '/repo';
    const killedProcesses = [];
    const cleanupCount = cleanupStaleProcesses({
        ports: { grottoPort: 8083, websitePort: 8080 },
        processTools: {
            killProcess: (pid, signal) => killedProcesses.push([pid, signal]),
            listListeningProcessIds: (port) => (port === 8083 ? [333] : []),
            readProcessCommand: () => 'bun --watch src/grotto-server.ts',
            readProcessWorkingDirectory: () => path.join(repositoryRoot, 'apps', 'server'),
            waitForProcessExit: () => undefined,
        },
        repositoryRoot,
    });

    assert.equal(cleanupCount, 1);
    assert.deepEqual(killedProcesses, [[333, 'SIGTERM']]);
});
