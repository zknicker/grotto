import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSaveInput,
    createConnectionDraft,
    type McpConnection,
    splitArgs,
    visibleConnections,
} from './mcp-server-shared.ts';

test('splitArgs splits on whitespace and drops empty parts', () => {
    assert.deepEqual(splitArgs('  serve  --port 8080 '), ['serve', '--port', '8080']);
});

test('splitArgs returns an empty list for blank input', () => {
    assert.deepEqual(splitArgs('   '), []);
});

test('visibleConnections filters by connection state', () => {
    const connected = connection('connected', true);
    const disconnected = connection('disconnected', false);

    assert.deepEqual(visibleConnections([connected, disconnected], 'all'), [
        connected,
        disconnected,
    ]);
    assert.deepEqual(visibleConnections([connected, disconnected], 'connected'), [connected]);
    assert.deepEqual(visibleConnections([connected, disconnected], 'not-connected'), [
        disconnected,
    ]);
});

test('buildSaveInput includes optional static OAuth registration details', () => {
    assert.deepEqual(
        buildSaveInput({
            ...createConnectionDraft(),
            auth: 'oauth',
            name: 'Example',
            oauthClientId: 'client-id',
            oauthClientSecret: 'secret',
            oauthScopes: 'openid profile',
            url: 'https://example.com/mcp',
        }),
        {
            auth: 'oauth',
            headers: undefined,
            name: 'Example',
            oauthClientId: 'client-id',
            oauthClientSecret: 'secret',
            oauthScopes: ['openid', 'profile'],
            url: 'https://example.com/mcp',
        }
    );
});

function connection(id: string, connected: boolean): McpConnection {
    return {
        accountLabel: null,
        affectedAgents: [],
        auth: 'oauth',
        builtIn: false,
        connected,
        headerNames: [],
        id,
        name: id,
        preset: null,
        url: `https://${id}.example/mcp`,
    };
}
