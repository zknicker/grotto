import { afterAll, beforeAll, expect, test } from 'bun:test';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { McpOAuthRelay } from '../src/server-mcp/oauth-relay.ts';
import { emptySecret, McpRuntime } from '../src/server-mcp/runtime.ts';
import { startControlledOAuthMcpProvider } from './controlled-oauth-mcp.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

const connectionId = 'mcp_oauthrelaytest01';
const redirectUrl = 'http://127.0.0.1:8091/mcp/oauth/callback';
const serverId = 'srv_oauthrelaytest01';

let cluster: PostgresCluster;
let connection: GrottoConnection;
let provider: Awaited<ReturnType<typeof startControlledOAuthMcpProvider>>;
let runtime: McpRuntime;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    connection = await connectGrottoDatabase(cluster.databaseUrl);
    provider = await startControlledOAuthMcpProvider();
    runtime = new McpRuntime(connection.db);
    await connection.db.execute(
        `insert into servers (id, display_name, slug)
         values ('${serverId}', 'OAuth Relay', 'oauth-relay')`
    );
    await connection.db.execute(
        `insert into mcp_connections
            (id, server_id, name, url, auth, connected, header_names, tools)
         values
            ('${connectionId}', '${serverId}', 'Controlled', '${provider.origin}/mcp',
             'oauth', false, ARRAY[]::text[], ARRAY[]::text[])`
    );
    await runtime.writeSecret(connectionId, emptySecret());
});

afterAll(async () => {
    await runtime.close();
    provider.stop();
    await connection.close();
    await cluster.stop();
});

test('completes OAuth on Server and persists discovered identity and tools', async () => {
    const relay = new McpOAuthRelay(connection.db, runtime);
    const trust = await relay.start({
        allowAuthorizationServerOrigin: false,
        connectionId,
        redirectUrl,
    });
    expect(trust).toEqual({
        authorizationServerOrigin: provider.origin,
        status: 'trust-required',
    });

    const started = await relay.start({
        allowAuthorizationServerOrigin: true,
        connectionId,
        redirectUrl,
    });
    expect(started.status).toBe('ready');
    if (started.status !== 'ready') {
        throw new Error('Expected a ready OAuth attempt.');
    }
    const authorization = new URL(started.authorizationUrl);
    const callback = await approve(authorization);
    const state = callback.searchParams.get('state');
    const code = callback.searchParams.get('code');
    expect(state).toBeTruthy();
    expect(code).toBeTruthy();

    await expect(relay.complete(String(state), String(code))).resolves.toEqual({
        status: 'complete',
    });
    await expect(relay.complete(String(state), String(code))).resolves.toEqual({
        status: 'expired',
    });

    const [stored] = await connection.db.execute<{
        account_label: string;
        connected: boolean;
        tools: string[];
    }>(
        `select account_label, connected, tools
         from mcp_connections where id = '${connectionId}'`
    );
    expect(stored).toEqual({
        account_label: 'controlled@example.test',
        connected: true,
        tools: ['echo'],
    });
    expect(provider.registrations()).toBe(1);
    expect(await runtime.readSecret(connectionId)).toMatchObject({
        approvedAuthorizationServerOrigins: [provider.origin],
        tokens: {
            access_token: 'controlled-access',
            refresh_token: 'controlled-refresh',
            token_type: 'Bearer',
        },
    });
});

test('expires routing state before exchanging the callback code', async () => {
    let now = 1000;
    const relay = new McpOAuthRelay(connection.db, runtime, () => now, 50);
    const started = await relay.start({
        allowAuthorizationServerOrigin: false,
        connectionId,
        redirectUrl,
    });
    expect(started.status).toBe('ready');
    if (started.status !== 'ready') {
        throw new Error('Expected a ready OAuth attempt.');
    }
    const authorization = new URL(started.authorizationUrl);
    now += 51;

    await expect(
        relay.complete(String(authorization.searchParams.get('state')), 'unused-code')
    ).resolves.toEqual({ status: 'expired' });
});

async function approve(authorization: URL): Promise<URL> {
    const response = await fetch(`${authorization.origin}/approve`, {
        body: new URLSearchParams({
            code_challenge: authorization.searchParams.get('code_challenge') ?? '',
            redirect_uri: authorization.searchParams.get('redirect_uri') ?? '',
            state: authorization.searchParams.get('state') ?? '',
        }),
        method: 'POST',
        redirect: 'manual',
    });
    const location = response.headers.get('location');
    if (!location) {
        throw new Error('The controlled OAuth provider did not return a callback.');
    }
    return new URL(location);
}
