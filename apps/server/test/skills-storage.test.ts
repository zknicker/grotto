import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-skills-storage-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');
const originalFetch = globalThis.fetch;

const [
    { ensureDatabaseSchema },
    { databaseClient },
    {
        formatSkillInventorySyncStateId,
        getSkillInventorySyncState,
        listSkillRecordsForRuntime,
        saveSkillRecordsForRuntime,
    },
    { saveAgentRuntimeConnection },
    { isRuntimeSkillInventoryStale, runtimeSkillInventoryRefreshIntervalMs },
    { listSkills },
] = await Promise.all([
    import('../src/db/bootstrap.ts'),
    import('../src/db/index.ts'),
    import('../src/storage/skills.ts'),
    import('../src/storage/agent-runtime-connections.ts'),
    import('../src/skills/inventory-sync.ts'),
    import('../src/skills/service.ts'),
]);

ensureDatabaseSchema();

test.beforeEach(() => {
    globalThis.fetch = originalFetch;
    databaseClient.exec('delete from agent_runtime_connections');
    databaseClient.exec('delete from skills');
    databaseClient.exec("delete from sync_state where kind = 'skill'");
});

test('skills storage stores runtime skill rows and reports content changes only', async () => {
    const first = await saveSkillRecordsForRuntime({
        runtimeId: 'runtime-1',
        skills: [
            {
                allowedTools: null,
                configChecks: [],
                description: 'Reads pages.',
                id: 'browser',
                install: [],
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'Browser',
                requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
                source: 'installed',
                updatedAt: null,
            },
        ],
        syncedAt: '2026-06-02T00:00:00.000Z',
    });
    const second = await saveSkillRecordsForRuntime({
        runtimeId: 'runtime-1',
        skills: await listSkillRecordsForRuntime('runtime-1'),
        syncedAt: '2026-06-02T00:05:00.000Z',
    });
    const state = await getSkillInventorySyncState('runtime-1');

    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
    assert.equal(state?.lastSuccessfulAt, '2026-06-02T00:05:00.000Z');
    assert.equal(state?.id, formatSkillInventorySyncStateId('runtime-1'));
    assert.deepEqual(
        (await listSkillRecordsForRuntime('runtime-1')).map((skill) => skill.id),
        ['browser']
    );
});

test('skill inventory staleness follows the refresh interval', () => {
    const now = new Date('2026-06-02T00:20:00.000Z');
    const fresh = new Date(now.getTime() - runtimeSkillInventoryRefreshIntervalMs + 1000);
    const stale = new Date(now.getTime() - runtimeSkillInventoryRefreshIntervalMs - 1000);

    assert.equal(
        isRuntimeSkillInventoryStale({
            lastSyncedAt: fresh.toISOString(),
            now,
        }),
        false
    );
    assert.equal(
        isRuntimeSkillInventoryStale({
            lastSyncedAt: stale.toISOString(),
            now,
        }),
        true
    );
    assert.equal(isRuntimeSkillInventoryStale({ lastSyncedAt: null, now }), true);
});

test('skill service ignores cached skill rows for disabled runtime connections', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: false,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-06-02T00:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    await saveSkillRecordsForRuntime({
        runtimeId: 'runtime-1',
        skills: [
            {
                allowedTools: null,
                configChecks: [],
                description: 'Reads pages.',
                eligible: true,
                id: 'browser',
                install: [],
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'Browser',
                requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
                source: 'installed',
                updatedAt: null,
            },
        ],
        syncedAt: '2026-06-02T00:00:00.000Z',
    });

    assert.deepEqual((await listSkills()).skills, []);
});

test('skill service keeps cached skill rows for temporarily unhealthy runtimes', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-06-02T00:00:00.000Z',
        lastError: 'Runtime event stream closed.',
        name: 'Runtime',
    });
    await saveSkillRecordsForRuntime({
        runtimeId: 'runtime-1',
        skills: [
            {
                allowedTools: null,
                configChecks: [],
                description: 'Reads pages.',
                eligible: true,
                id: 'browser',
                install: [],
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'Browser',
                requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
                source: 'installed',
                updatedAt: null,
            },
        ],
        syncedAt: '2026-06-02T00:00:00.000Z',
    });

    assert.deepEqual(
        (await listSkills()).skills.map((skill) => ({
            dependencyState: skill.dependencyState,
            id: skill.id,
        })),
        [{ dependencyState: 'ready', id: 'browser' }]
    );
});

test('skill service exposes Runtime read-only tools', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-06-02T00:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/tools') {
            return Response.json({
                tools: [
                    {
                        configured: true,
                        description: 'Run shell commands inside the agent workspace.',
                        enabled: true,
                        id: 'bash',
                        label: 'Bash',
                        name: 'bash',
                        readOnly: true,
                        tools: ['bash'],
                    },
                ],
            });
        }
        throw new Error(`Unexpected fetch: ${url.pathname}`);
    };

    const tools = (await listSkills()).tools;
    assert.deepEqual(
        tools.find((tool) => tool.id === 'bash'),
        {
            configured: true,
            description: 'Run shell commands inside the agent workspace.',
            diagnostic: null,
            enabled: true,
            id: 'bash',
            name: 'Bash',
            readOnly: true,
            tools: ['bash'],
            usability: 'enabled',
        }
    );
});
