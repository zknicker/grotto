import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSaveInput,
    createConnectionDraft,
    joinArgs,
    type McpConnection,
    splitArgs,
    toEnvRecord,
    visibleConnections,
} from './mcp-server-shared.ts';

test('splitArgs splits on whitespace and drops empty parts', () => {
    assert.deepEqual(splitArgs('  serve  --port 8080 '), ['serve', '--port', '8080']);
});

test('splitArgs returns an empty list for blank input', () => {
    assert.deepEqual(splitArgs('   '), []);
});

test('joinArgs joins args with single spaces', () => {
    assert.equal(joinArgs(['serve', '--port', '8080']), 'serve --port 8080');
});

test('toEnvRecord trims names and drops empty names', () => {
    assert.deepEqual(
        toEnvRecord([
            { name: '  TOKEN  ', value: 'abc' },
            { name: '   ', value: 'ignored' },
        ]),
        { TOKEN: 'abc' }
    );
});

test('toEnvRecord keeps blank values for named entries', () => {
    assert.deepEqual(toEnvRecord([{ name: 'NEW', value: '' }]), { NEW: '' });
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
            args: undefined,
            auth: 'oauth',
            command: undefined,
            env: undefined,
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
        args: [],
        auth: 'oauth',
        builtIn: false,
        command: null,
        connected,
        headerNames: [],
        id,
        name: id,
        preset: null,
        transport: 'http',
        url: `https://${id}.example/mcp`,
    };
}
