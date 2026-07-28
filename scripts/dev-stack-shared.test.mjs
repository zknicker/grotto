import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveDevPorts } from './dev-ports.mjs';
import {
    cleanupStaleProcesses,
    createDevStackEnvironment,
    formatPortBlockers,
    seedDevPreseedMerchbasePluginConfig,
    waitForRuntimeReady,
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

test('waitForRuntimeReady reads the Runtime capabilities health envelope', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    const sentAuthHeaders = [];

    globalThis.fetch = async (url, init) => {
        requestedUrls.push(String(url));
        sentAuthHeaders.push(init?.headers?.authorization ?? null);
        return Response.json({
            health: {
                ok: true,
                status: 'healthy',
                timestamp: '2026-05-28T00:00:00.000Z',
            },
        });
    };

    try {
        await waitForRuntimeReady(undefined, 500, { token: 'dev-token' });
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.deepEqual(requestedUrls, ['http://127.0.0.1:18790/capabilities']);
    // The runtime gates /capabilities behind a bearer token; the probe must send it.
    assert.deepEqual(sentAuthHeaders, ['Bearer dev-token']);
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
            // Short-circuit token resolution so this test never touches ~/.tavern.
            TAVERN_RUNTIME_TOKEN: 'env-token',
        },
        ports,
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.PATH, '/usr/bin');
    assert.equal(environment.TAVERN_RUNTIME_TOKEN, 'env-token');
    assert.equal(
        environment.GROTTO_COMPUTER_DATA_ROOT,
        path.join(os.homedir(), '.tavern', 'dev', 'alpha', 'computer')
    );
    assert.equal(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern', 'dev', 'alpha', 'tavern.sqlite')
    );
    assert.equal(
        environment.TAVERN_RUNTIME_ROOT,
        path.join(os.homedir(), '.tavern', 'dev', 'alpha', 'runtime')
    );
    assert.equal(environment.TAVERN_RUNTIME_PORT, '42002');
    assert.equal(environment.TAVERN_SERVER_PORT, '42001');
    assert.equal(environment.TAVERN_WEBSITE_PORT, '42000');
    assert.equal(environment.TAVERN_DEV_STACK, '1');
    assert.notEqual(environment.DATABASE_PATH, path.join(os.homedir(), '.tavern', 'tavern.sqlite'));
    assert.notEqual(
        environment.DATABASE_PATH,
        path.join(os.homedir(), '.tavern', 'dev', 'tavern.sqlite')
    );
    assert.notEqual(environment.TAVERN_RUNTIME_ROOT, path.join(os.homedir(), '.tavern', 'runtime'));
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
            TAVERN_RUNTIME_PORT: '39190',
            TAVERN_RUNTIME_ROOT: '/tmp/tavern-runtime',
            TAVERN_RUNTIME_TOKEN: 'env-token',
        },
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.DATABASE_PATH, '/tmp/tavern.sqlite');
    assert.equal(environment.TAVERN_RUNTIME_PORT, '39190');
    assert.equal(environment.TAVERN_RUNTIME_ROOT, '/tmp/tavern-runtime');
});

test('createDevStackEnvironment persists a runtime token in grotto.json under the runtime root', () => {
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-dev-token-'));
    const configPath = path.join(runtimeRoot, 'grotto.json');

    const first = createDevStackEnvironment({
        baseEnvironment: { TAVERN_RUNTIME_ROOT: runtimeRoot },
        repositoryRoot: '/repo/tavern',
    });

    const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8')).token;
    assert.equal(first.TAVERN_RUNTIME_TOKEN, persisted);
    assert.ok(persisted.length > 20, 'expected a generated token');

    // A second resolution (new dev-stack session, or a standalone CLI run
    // against the same runtime root) must yield the same token.
    const second = createDevStackEnvironment({
        baseEnvironment: { TAVERN_RUNTIME_ROOT: runtimeRoot },
        repositoryRoot: '/repo/tavern',
    });
    assert.equal(second.TAVERN_RUNTIME_TOKEN, persisted);
});

test('createDevStackEnvironment reads an existing token from grotto.json', () => {
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-dev-token-'));
    fs.writeFileSync(
        path.join(runtimeRoot, 'grotto.json'),
        `${JSON.stringify({ operatorNote: 'keep me', token: 'persisted-token' })}\n`
    );

    const environment = createDevStackEnvironment({
        baseEnvironment: { TAVERN_RUNTIME_ROOT: runtimeRoot },
        repositoryRoot: '/repo/tavern',
    });

    assert.equal(environment.TAVERN_RUNTIME_TOKEN, 'persisted-token');
});

test('createDevStackEnvironment preserves unknown grotto.json keys when generating a token', () => {
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-dev-token-'));
    const configPath = path.join(runtimeRoot, 'grotto.json');
    fs.writeFileSync(configPath, `${JSON.stringify({ operatorNote: 'keep me' })}\n`);

    const environment = createDevStackEnvironment({
        baseEnvironment: { TAVERN_RUNTIME_ROOT: runtimeRoot },
        repositoryRoot: '/repo/tavern',
    });

    const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(persisted.operatorNote, 'keep me');
    assert.equal(environment.TAVERN_RUNTIME_TOKEN, persisted.token);
});

test('seedDevPreseedMerchbasePluginConfig copies local preseed values once', () => {
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-dev-preseed-repo-'));
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-dev-preseed-runtime-'));
    fs.writeFileSync(
        path.join(repositoryRoot, '.env'),
        [
            'DEV_PRESEED_MERCHBASE_ENABLED=true',
            'DEV_PRESEED_MERCHBASE_API_KEY=env-key',
            'DEV_PRESEED_MERCHBASE_BASE_URL=https://env.merchbase.test',
            'DEV_PRESEED_MERCHBASE_DEFAULT_ACCOUNT=acct_env',
            'DEV_PRESEED_MERCHBASE_DEFAULT_MARKETPLACE=UK',
            '',
        ].join('\n')
    );

    assert.deepEqual(
        seedDevPreseedMerchbasePluginConfig({
            baseEnvironment: {},
            repositoryRoot,
            runtimeRoot,
        }),
        { seededConfig: true, seededSecret: true }
    );
    assert.deepEqual(readMerchbasePluginRows(runtimeRoot), {
        config: {
            baseUrl: 'https://env.merchbase.test',
            defaultAccount: 'acct_env',
            defaultMarketplace: 'UK',
        },
        enabled: 1,
        secret: { apiKey: 'env-key' },
    });

    fs.writeFileSync(
        path.join(repositoryRoot, '.env'),
        [
            'DEV_PRESEED_MERCHBASE_ENABLED=false',
            'DEV_PRESEED_MERCHBASE_API_KEY=changed-key',
            'DEV_PRESEED_MERCHBASE_BASE_URL=https://changed.merchbase.test',
            '',
        ].join('\n')
    );

    assert.deepEqual(
        seedDevPreseedMerchbasePluginConfig({
            baseEnvironment: {},
            repositoryRoot,
            runtimeRoot,
        }),
        { seededConfig: false, seededSecret: false }
    );
    assert.deepEqual(readMerchbasePluginRows(runtimeRoot), {
        config: {
            baseUrl: 'https://env.merchbase.test',
            defaultAccount: 'acct_env',
            defaultMarketplace: 'UK',
        },
        enabled: 1,
        secret: { apiKey: 'env-key' },
    });
});

test('cleanupStaleProcesses closes the old Tauri desktop app in desktop mode', () => {
    const killedProcesses = [];
    const cleanupCount = cleanupStaleProcesses({
        mode: 'desktop-runtime',
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

function readMerchbasePluginRows(runtimeRoot) {
    const databasePath = path.join(runtimeRoot, 'data', 'runtime.db');
    const [pluginJson] = JSON.parse(
        spawnSqlite(databasePath, [
            "SELECT enabled, config_json FROM runtime_plugins WHERE id = 'merchbase';",
        ])
    );
    const [secretJson] = JSON.parse(
        spawnSqlite(databasePath, [
            "SELECT secret_json FROM runtime_plugin_secrets WHERE plugin_id = 'merchbase';",
        ])
    );
    return {
        config: JSON.parse(pluginJson.config_json),
        enabled: pluginJson.enabled,
        secret: JSON.parse(secretJson.secret_json),
    };
}

function spawnSqlite(databasePath, statements) {
    const result = spawnSync('sqlite3', ['-json', databasePath], {
        encoding: 'utf8',
        input: statements.join('\n'),
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
}
