import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createMcpConnection, getMcpConnection, readMcpSecret } from './mcp-connections.ts';
import { createOAuthProvider, resetMcpOAuthFlowCredentials, secureMcpFetch } from './mcp-oauth.ts';

describe('MCP OAuth provider', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        getMcpConnection('merchbase');
    });

    afterEach(() => closeDb());

    it('uses dynamic client registration for generic and MerchBase connections', async () => {
        const provider = createProvider(false);

        expect(await provider.clientInformation()).toBeUndefined();
        expect(provider.clientMetadata.token_endpoint_auth_method).toBe('none');
    });

    it('requires authorization-server trust once and persists that decision', async () => {
        const origin = 'https://accounts.example.test';

        await expect(
            createProvider(false).validateAuthorizationServerURL?.(
                'https://app.merchbase.co/mcp',
                origin
            )
        ).rejects.toThrow('Confirm this origin');

        await createProvider(true).validateAuthorizationServerURL?.(
            'https://app.merchbase.co/mcp',
            origin
        );

        expect(readMcpSecret('merchbase').approvedAuthorizationServerOrigins).toEqual([origin]);
        await expect(
            createProvider(false).validateAuthorizationServerURL?.(
                'https://app.merchbase.co/mcp',
                origin
            )
        ).resolves.toBeUndefined();
    });

    it('rejects resource indicators on a different origin', async () => {
        await expect(
            createProvider(false).validateResourceURL?.(
                'https://app.merchbase.co/mcp',
                'https://attacker.example/resource'
            )
        ).rejects.toThrow('must match the server origin');
    });

    it('uses configured generic client credentials and scopes', async () => {
        const connection = createMcpConnection({
            auth: 'oauth',
            name: 'Configured',
            oauthClientId: 'configured-client',
            oauthClientSecret: 'configured-secret',
            oauthScopes: ['read', 'write'],
            url: 'https://configured.example/mcp',
        });
        if (!connection) {
            throw new Error('Connection was not created.');
        }
        const provider = createOAuthProvider(connection.id, 'http://127.0.0.1:3000/callback', {
            allowAuthorizationServerOrigin: false,
            onRedirect() {
                throw new Error('Unexpected redirect.');
            },
        });

        await expect(provider.clientInformation()).resolves.toEqual({
            client_id: 'configured-client',
            client_secret: 'configured-secret',
        });
        expect(provider.clientMetadata).toMatchObject({
            scope: 'read write',
            token_endpoint_auth_method: 'client_secret_basic',
        });
    });

    it('starts each dynamic registration flow without stale client information', async () => {
        const provider = createProvider(false);
        await provider.saveClientInformation?.({
            client_id: 'stale-registration',
        });
        expect(readMcpSecret('merchbase').clientInformation).toBeDefined();

        resetMcpOAuthFlowCredentials('merchbase');

        await expect(createProvider(false).clientInformation()).resolves.toBeUndefined();
        expect(readMcpSecret('merchbase').clientInformation).toBeUndefined();
    });

    it('rejects insecure remote OAuth URLs', async () => {
        expect(() =>
            createOAuthProvider('merchbase', 'http://callback.example/callback', {
                allowAuthorizationServerOrigin: false,
                onRedirect() {
                    throw new Error('Unexpected redirect.');
                },
            })
        ).toThrow('must use HTTPS');
        await expect(
            createProvider(true).validateAuthorizationServerURL?.(
                'https://app.merchbase.co/mcp',
                'http://accounts.example.test'
            )
        ).rejects.toThrow('must use HTTPS');
        await expect(secureMcpFetch('http://tokens.example.test/token')).rejects.toThrow(
            'must use HTTPS'
        );
    });
});

function createProvider(allowAuthorizationServerOrigin: boolean) {
    return createOAuthProvider('merchbase', 'http://127.0.0.1:3000/callback', {
        allowAuthorizationServerOrigin,
        onRedirect() {
            throw new Error('Unexpected redirect.');
        },
    });
}
