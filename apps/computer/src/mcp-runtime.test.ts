import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentMcpRuntime } from './mcp-runtime.ts';
import { startControlledOAuthMcpProvider } from './test-fixtures/controlled-oauth-mcp.ts';

const connectionId = 'mcp_1234567890123456';
const agentId = 'agt_attachment_test';
const fixture = fileURLToPath(new URL('./test-fixtures/deterministic-mcp.ts', import.meta.url));
let root: string;
let runtime: AttachmentMcpRuntime;

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'grotto-mcp-'));
    runtime = new AttachmentMcpRuntime(join(root, 'attachment-a'));
    await runtime.upsert({
        args: [fixture],
        auth: 'none',
        command: process.execPath,
        env: { MCP_PREFIX: 'attachment-a' },
        headers: {},
        id: connectionId,
        name: 'Deterministic',
        oauthScopes: [],
        preset: null,
        url: null,
    });
});

afterEach(async () => {
    await runtime.close();
    await rm(root, { force: true, recursive: true });
});

test('invokes only an exactly granted tool from the attachment-local MCP session', async () => {
    expect(await runtime.listTools(connectionId)).toEqual(['echo']);
    runtime.replaceAgentGrants(agentId, [{ agentId, connectionId, toolName: 'echo' }]);

    const result = await runtime.invoke({
        agentId,
        args: { value: 'allowed' },
        connectionId,
        toolName: 'echo',
    });
    expect(result).toMatchObject({
        content: [{ text: 'attachment-a:allowed', type: 'text' }],
    });

    await expect(
        runtime.invoke({
            agentId,
            args: {},
            connectionId,
            toolName: 'not-granted',
        })
    ).rejects.toThrow('not granted');

    runtime.replaceAgentGrants(agentId, []);
    await expect(
        runtime.invoke({ agentId, args: {}, connectionId, toolName: 'echo' })
    ).rejects.toThrow('not granted');
});

test('the same grant cannot resolve a connection from another attachment', async () => {
    const other = new AttachmentMcpRuntime(join(root, 'attachment-b'));
    other.replaceAgentGrants(agentId, [{ agentId, connectionId, toolName: 'echo' }]);
    await expect(
        other.invoke({ agentId, args: {}, connectionId, toolName: 'echo' })
    ).rejects.toThrow('does not belong to this attachment');
    await other.close();

    expect(
        (await stat(join(root, 'attachment-a', 'connections', `${connectionId}.json`))).mode & 0o777
    ).toBe(0o600);
});

test('keeps PKCE and tokens in the attachment vault through DCR and reconnect', async () => {
    const provider = await startControlledOAuthMcpProvider();
    const oauthId = 'mcp_oauth12345678901';
    try {
        await runtime.upsert({
            args: [],
            auth: 'oauth',
            command: null,
            env: {},
            headers: {},
            id: oauthId,
            name: 'Controlled OAuth account',
            oauthScopes: ['read'],
            preset: null,
            url: `${provider.origin}/mcp`,
        });
        const first = await runtime.startOAuth({
            allowAuthorizationServerOrigin: true,
            connectionId: oauthId,
            redirectUrl: 'http://127.0.0.1:8091/mcp/oauth/callback',
            routingState: 'routing-state-one',
        });
        expect(first.status).toBe('ready');
        if (first.status !== 'ready') {
            throw new Error('OAuth did not start.');
        }
        const callback = await approve(first.authorizationUrl);
        expect(callback.searchParams.get('state')).toBe('routing-state-one');
        await expect(
            runtime.completeOAuth({
                code: callback.searchParams.get('code') ?? '',
                connectionId: oauthId,
                redirectUrl: 'http://127.0.0.1:8091/mcp/oauth/callback',
                state: 'routing-state-one',
            })
        ).resolves.toEqual({
            accountLabel: 'controlled@example.test',
            tools: ['echo'],
        });
        expect(await runtime.isConnected(oauthId)).toBe(true);
        expect(provider.registrations()).toBe(1);

        const publicRecord = await readFile(
            join(root, 'attachment-a', 'connections', `${oauthId}.json`),
            'utf8'
        );
        const vaultRecord = await readFile(
            join(root, 'attachment-a', 'vault', `${oauthId}.json`),
            'utf8'
        );
        expect(publicRecord).not.toContain('controlled-access');
        expect(vaultRecord).toContain('controlled-access');
        expect(vaultRecord).toContain('verifier');

        provider.expireAccessToken();
        await expect(runtime.listTools(oauthId)).resolves.toEqual(['echo']);
        expect(
            await readFile(join(root, 'attachment-a', 'vault', `${oauthId}.json`), 'utf8')
        ).toContain('controlled-access-refreshed');

        runtime.replaceAgentGrants(agentId, [{ agentId, connectionId: oauthId, toolName: 'echo' }]);
        const reconnect = await runtime.startOAuth({
            allowAuthorizationServerOrigin: false,
            connectionId: oauthId,
            redirectUrl: 'http://127.0.0.1:8091/mcp/oauth/callback',
            routingState: 'routing-state-two',
        });
        expect(reconnect.status).toBe('ready');
        expect(await runtime.isConnected(oauthId)).toBe(false);
        expect(provider.registrations()).toBe(2);
        await expect(
            runtime.invoke({
                agentId,
                args: { value: 'old-account' },
                connectionId: oauthId,
                toolName: 'echo',
            })
        ).rejects.toThrow('not granted');
    } finally {
        provider.stop();
    }
});

test('preserves packaged Google, MerchBase DCR, and pre-registered custom clients', async () => {
    const provider = await startControlledOAuthMcpProvider();
    const priorId = process.env.TAVERN_GOOGLE_OAUTH_CLIENT_ID;
    const priorSecret = process.env.TAVERN_GOOGLE_OAUTH_CLIENT_SECRET;
    process.env.TAVERN_GOOGLE_OAUTH_CLIENT_ID = 'packaged-google-client';
    process.env.TAVERN_GOOGLE_OAUTH_CLIENT_SECRET = 'packaged-google-secret';
    try {
        const cases = [
            {
                clientId: undefined,
                id: 'mcp_merchbase1234567',
                name: 'MerchBase',
                preset: 'merchbase' as const,
            },
            {
                clientId: 'custom-client',
                id: 'mcp_custom1234567890',
                name: 'Custom',
                preset: null,
            },
            {
                clientId: undefined,
                id: 'mcp_google1234567890',
                name: 'Google Calendar',
                preset: 'google-calendar' as const,
            },
        ];
        for (const item of cases) {
            await runtime.upsert({
                args: [],
                auth: 'oauth',
                command: null,
                env: {},
                headers: {},
                id: item.id,
                name: item.name,
                oauthClientId: item.clientId,
                oauthClientSecret: item.clientId ? 'custom-secret' : undefined,
                oauthScopes: item.clientId ? ['custom.read'] : [],
                preset: item.preset,
                url: `${provider.origin}/mcp`,
            });
            const result = await runtime.startOAuth({
                allowAuthorizationServerOrigin: true,
                connectionId: item.id,
                redirectUrl: 'http://127.0.0.1:8091/mcp/oauth/callback',
                routingState: `state-${item.id}`,
            });
            expect(result.status).toBe('ready');
            if (result.status === 'ready') {
                const authorize = new URL(result.authorizationUrl);
                if (item.preset === 'merchbase') {
                    expect(authorize.searchParams.get('scope')).toBe('openid profile email');
                } else if (item.preset === 'google-calendar') {
                    expect(authorize.searchParams.get('client_id')).toBe('packaged-google-client');
                } else {
                    expect(authorize.searchParams.get('client_id')).toBe('custom-client');
                    expect(authorize.searchParams.get('scope')).toBe('custom.read');
                }
            }
        }
        expect(provider.registrations()).toBe(1);
    } finally {
        process.env.TAVERN_GOOGLE_OAUTH_CLIENT_ID = priorId;
        process.env.TAVERN_GOOGLE_OAUTH_CLIENT_SECRET = priorSecret;
        provider.stop();
    }
});

async function approve(authorizationUrl: string) {
    const authorize = new URL(authorizationUrl);
    const response = await fetch(new URL('/approve', authorize), {
        body: new URLSearchParams({
            code_challenge: authorize.searchParams.get('code_challenge') ?? '',
            redirect_uri: authorize.searchParams.get('redirect_uri') ?? '',
            state: authorize.searchParams.get('state') ?? '',
        }),
        method: 'POST',
        redirect: 'manual',
    });
    return new URL(response.headers.get('location') ?? '');
}
