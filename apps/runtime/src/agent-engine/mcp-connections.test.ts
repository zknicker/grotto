import { agentRuntimeMcpConnectionUpdateSchema } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import {
    createMcpConnection,
    createPresetMcpConnection,
    disconnectMcpConnection,
    getMcpConnection,
    hasAgentMcpToolGrant,
    listMcpConnections,
    readMcpSecret,
    setAgentMcpToolGrant,
    updateMcpConnection,
    writeMcpSecret,
} from './mcp-connections.ts';

describe('MCP connections', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agent-1',
                isAdmin: false,
                name: 'AgentOne',
                primaryColor: null,
                workspaceFolder: '/tmp/agent-one',
            },
        });
    });

    afterEach(() => closeDb());

    it('seeds built-ins and supports another account for the same preset', () => {
        expect(listMcpConnections()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    builtIn: true,
                    id: 'google-calendar',
                    preset: 'google-calendar',
                }),
                expect.objectContaining({
                    builtIn: true,
                    id: 'merchbase',
                    preset: 'merchbase',
                }),
            ])
        );

        const extra = createPresetMcpConnection({
            name: 'MerchBase account',
            preset: 'merchbase',
        });

        expect(extra).toMatchObject({
            builtIn: false,
            id: 'merchbase-account',
            preset: 'merchbase',
        });
    });

    it('stores exact tool grants and clears them with credentials on disconnect', () => {
        getMcpConnection('merchbase');
        writeMcpSecret('merchbase', {
            approvedAuthorizationServerOrigins: [],
            env: {},
            headers: {},
            tokens: { access_token: 'secret' },
        });
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: 'merchbase',
            enabled: true,
            toolName: 'merchbase_sales',
        });

        expect(hasAgentMcpToolGrant('agent-1', 'merchbase', 'merchbase_sales')).toBe(true);
        expect(disconnectMcpConnection('merchbase')).toEqual([{ id: 'agent-1', name: 'AgentOne' }]);
        expect(hasAgentMcpToolGrant('agent-1', 'merchbase', 'merchbase_sales')).toBe(false);
        expect(readMcpSecret('merchbase').tokens).toBeUndefined();
    });

    it('drops server-bound credentials and grants when arguments change', () => {
        const connection = createMcpConnection({
            args: ['--tenant', 'one'],
            auth: 'none',
            command: 'inventory-mcp',
            env: { API_TOKEN: 'secret' },
            name: 'Inventory',
        });
        if (!connection) {
            throw new Error('Connection was not created.');
        }
        writeMcpSecret(connection.id, {
            approvedAuthorizationServerOrigins: ['https://login.one.example'],
            clientInformation: { client_id: 'client' },
            env: { API_TOKEN: 'secret' },
            headers: {},
            tokens: { access_token: 'secret' },
        });
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });

        updateMcpConnection(connection.id, { args: ['--tenant', 'two'] });

        expect(getMcpConnection(connection.id)?.api.args).toEqual(['--tenant', 'two']);
        expect(readMcpSecret(connection.id)).toEqual({
            approvedAuthorizationServerOrigins: [],
            env: {},
            headers: {},
            oauthScopes: [],
        });
        expect(hasAgentMcpToolGrant('agent-1', connection.id, 'search')).toBe(false);
    });

    it('validates the fully merged update before changing data', () => {
        const connection = createMcpConnection({
            auth: 'headers',
            headers: { Authorization: 'Bearer secret' },
            name: 'Inventory',
            url: 'https://inventory.example/mcp',
        });
        if (!connection) {
            throw new Error('Connection was not created.');
        }
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });

        expect(() =>
            updateMcpConnection(connection.id, { url: 'http://inventory.example/mcp' })
        ).toThrow('must use HTTPS');

        expect(getMcpConnection(connection.id)?.api.url).toBe('https://inventory.example/mcp');
        expect(readMcpSecret(connection.id).headers).toEqual({
            Authorization: 'Bearer secret',
        });
        expect(hasAgentMcpToolGrant('agent-1', connection.id, 'search')).toBe(true);
    });

    it('clears explicitly emptied headers and stores generic OAuth client settings', () => {
        const headers = createMcpConnection({
            auth: 'headers',
            headers: { Authorization: 'Bearer secret' },
            name: 'Headers',
            url: 'https://headers.example/mcp',
        });
        const oauth = createMcpConnection({
            auth: 'oauth',
            name: 'OAuth',
            oauthClientId: 'client-id',
            oauthClientSecret: 'client-secret',
            oauthScopes: ['read', 'write'],
            url: 'https://oauth.example/mcp',
        });
        if (!(headers && oauth)) {
            throw new Error('Connections were not created.');
        }

        updateMcpConnection(headers.id, { headers: {} });

        expect(readMcpSecret(headers.id).headers).toEqual({});
        expect(readMcpSecret(oauth.id)).toMatchObject({
            configuredClientInformation: {
                client_id: 'client-id',
                client_secret: 'client-secret',
            },
            oauthScopes: ['read', 'write'],
        });
    });

    it('rejects preset smuggling and changes to seeded presets', () => {
        expect(() =>
            createMcpConnection({
                auth: 'oauth',
                name: 'Fake MerchBase',
                preset: 'merchbase',
                url: 'https://attacker.example/mcp',
            } as never)
        ).toThrow();
        expect(() => updateMcpConnection('merchbase', { name: 'Fake' })).toThrow(
            'cannot be changed'
        );
    });

    it('rejects insecure remote and userinfo-bearing HTTP URLs', () => {
        expect(() =>
            agentRuntimeMcpConnectionUpdateSchema.parse({
                url: 'http://mcp.example/mcp',
            })
        ).toThrow('must use HTTPS');
        expect(() =>
            agentRuntimeMcpConnectionUpdateSchema.parse({
                url: 'https://user:secret@mcp.example/mcp',
            })
        ).toThrow('cannot contain user information');
        expect(() =>
            createMcpConnection({
                auth: 'none',
                name: 'Insecure',
                url: 'http://mcp.example/mcp',
            })
        ).toThrow('must use HTTPS');
        expect(() =>
            createMcpConnection({
                auth: 'none',
                name: 'User info',
                url: 'https://user:secret@mcp.example/mcp',
            })
        ).toThrow('cannot contain user information');
        expect(
            createMcpConnection({
                auth: 'none',
                name: 'Loopback',
                url: 'http://127.0.0.1:8787/mcp',
            })
        ).toMatchObject({ connected: true });
    });
});
