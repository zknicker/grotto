/**
 * Regression tests: bearer token must survive status-update calls (mark sync, mark reachable,
 * mark failure) on the environment connection record, and every sync client request must carry
 * the Authorization header when the connection has a token.
 *
 * Also covers the saved-connection auth-wipe bug: a URL-only re-save (auth === undefined) must
 * preserve the stored authJson; only an explicit null/empty auth clears it.
 *
 * Covers the bug reported in: "Bearer token required." on startup agent sync when
 * TAVERN_RUNTIME_TOKEN is set via the environment.
 */
import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalTavernRuntimeUrl = process.env.TAVERN_RUNTIME_URL;
const originalTavernRuntimeToken = process.env.TAVERN_RUNTIME_TOKEN;

const capturedRequests: Array<{ authorization: string | undefined; url: string }> = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
    process.env.DATABASE_PATH = originalDatabasePath;
    process.env.TAVERN_RUNTIME_URL = originalTavernRuntimeUrl;
    process.env.TAVERN_RUNTIME_TOKEN = originalTavernRuntimeToken;
    globalThis.fetch = originalFetch;
    capturedRequests.length = 0;
    mock.restore();
});

test('environment connection authJson is preserved after markAgentRuntimeConnectionSync', async () => {
    const {
        saveEnvironmentAgentRuntimeConnection,
        getEnvironmentAgentRuntimeConnection,
        clearEnvironmentAgentRuntimeConnection,
    } = await import('../src/agent-runtime-connection/environment-override.ts');

    clearEnvironmentAgentRuntimeConnection();

    saveEnvironmentAgentRuntimeConnection({
        auth: { kind: 'token', token: 'test-token' },
        baseUrl: 'http://runtime.test',
        id: 'runtime-1',
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Test Runtime',
    });

    // Simulate a status-update call that does NOT pass auth (as markAgentRuntimeConnectionSync does)
    saveEnvironmentAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        id: 'runtime-1',
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
        name: 'Test Runtime',
    });

    const record = getEnvironmentAgentRuntimeConnection();
    assert.ok(record, 'environment connection record should exist');
    assert.equal(record.authJson, JSON.stringify({ kind: 'token', token: 'test-token' }));

    clearEnvironmentAgentRuntimeConnection();
});

test('saved connection authJson is preserved after a URL-only re-save (auth === undefined)', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-saved-auth-wipe-test-')),
        'test.sqlite'
    );

    const [{ ensureDatabaseSchema }, { saveAgentRuntimeConnection, getAgentRuntimeConnection }] =
        await Promise.all([
            import('../src/db/bootstrap.ts'),
            import('../src/storage/agent-runtime-connections.ts'),
        ]);

    ensureDatabaseSchema();

    // Initial save with URL + token.
    await saveAgentRuntimeConnection({
        auth: { kind: 'token', token: 'secret-saved-token' },
        baseUrl: 'http://runtime.test',
        id: 'saved-runtime-1',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Test Runtime',
    });

    // URL-only re-save (no auth field — simulates a status update or URL change with no token).
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        id: 'saved-runtime-1',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Test Runtime',
    });

    const record = await getAgentRuntimeConnection('saved-runtime-1');
    assert.ok(record, 'record should exist after re-save');
    assert.equal(
        record.authJson,
        JSON.stringify({ kind: 'token', token: 'secret-saved-token' }),
        'authJson must be preserved when auth is omitted from the re-save'
    );
});

test('saved connection authJson is cleared when auth is explicitly null', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-saved-auth-clear-test-')),
        'test.sqlite'
    );

    const [{ ensureDatabaseSchema }, { saveAgentRuntimeConnection, getAgentRuntimeConnection }] =
        await Promise.all([
            import('../src/db/bootstrap.ts'),
            import('../src/storage/agent-runtime-connections.ts'),
        ]);

    ensureDatabaseSchema();

    // Initial save with token.
    await saveAgentRuntimeConnection({
        auth: { kind: 'token', token: 'to-be-cleared' },
        baseUrl: 'http://runtime.test',
        id: 'saved-runtime-2',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Test Runtime',
    });

    // Explicit clear (auth: null).
    await saveAgentRuntimeConnection({
        auth: null,
        baseUrl: 'http://runtime.test',
        id: 'saved-runtime-2',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Test Runtime',
    });

    const record = await getAgentRuntimeConnection('saved-runtime-2');
    assert.ok(record, 'record should exist after explicit clear');
    assert.equal(record.authJson, null, 'authJson must be null after explicit auth: null clear');
});

test('settings and MCP connection client requests carry the Authorization header', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        capturedRequests.push({
            authorization: headers.get('authorization') ?? undefined,
            url: String(input),
        });
        return Response.json({});
    }) as typeof fetch;

    const { createAgentRuntimeClient } = await import('../src/agent-runtime/client.ts');
    const client = createAgentRuntimeClient('http://runtime.test', { token: 'test-token' });

    // Response bodies are junk; schema parse failures are fine — the assertion
    // is that every outbound request carries the bearer token.
    const calls: Array<() => Promise<unknown>> = [
        () => client.getTimezoneSettings(),
        () => client.listMcpConnections(),
        () => client.deleteMcpConnection('connection-1'),
        () => client.testMcpConnection('connection-1'),
        () => client.getCurrentAgentSession({ chatId: 'cht_1' }),
        () => client.resetAgentSession('cht_1', { agentId: 'agt_main' }),
    ];

    for (const call of calls) {
        await call().catch(() => undefined);
    }

    assert.equal(capturedRequests.length, calls.length);
    for (const request of capturedRequests) {
        assert.equal(
            request.authorization,
            'Bearer test-token',
            `${request.url} must carry the bearer token`
        );
    }
});

test('syncAgentRuntimeAgents sends Authorization header when environment connection has a token', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-auth-regression-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = 'http://127.0.0.1:18700';
    process.env.TAVERN_RUNTIME_TOKEN = 'e2e-runtime-token';

    const agentListResponse = {
        agents: [
            {
                enabledSkillIds: [],
                id: 'main',
                isAdmin: false,
                name: 'Main',
                primaryColor: null,
                workspaceFolder: '/tmp/agent-main',
            },
        ],
    };
    const capabilitiesResponse = {
        capabilities: [],
        health: { ok: true, status: 'healthy', timestamp: new Date().toISOString() },
        info: {
            agentRuntimeId: 'runtime-test-1',
            name: 'Test Runtime',
            protocolVersion: 1,
            version: '1.0.0',
        },
    };

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const authorization = (init?.headers as Record<string, string>)?.authorization;
        capturedRequests.push({ authorization, url });

        if (url.includes('/agents')) {
            return Response.json(agentListResponse);
        }
        if (url.includes('/workspace-instructions')) {
            return Response.json({
                agentId: 'main',
                renderedAt: new Date().toISOString(),
                sha256: 'abc123',
                updatedAt: new Date().toISOString(),
            });
        }
        return Response.json(capabilitiesResponse);
    }) as typeof fetch;

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, agentRuntimeSync] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/sync/agent-runtime-sync.ts'),
    ]);

    ensureDatabaseSchema();
    await agentRuntimeConnection.loadAgentRuntimeConnection();
    await agentRuntimeSync.syncAgentRuntimeAgents();

    const agentListRequest = capturedRequests.find((r) => r.url.includes('/agents'));
    assert.ok(agentListRequest, 'expected a request to /agents');
    assert.equal(
        agentListRequest.authorization,
        'Bearer e2e-runtime-token',
        'agents request must carry the bearer token'
    );
});
