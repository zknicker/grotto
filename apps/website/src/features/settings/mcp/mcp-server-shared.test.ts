import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSaveInput, createConnectionDraft, splitArgs } from './mcp-server-shared.ts';

test('splitArgs splits on whitespace and drops empty parts', () => {
    assert.deepEqual(splitArgs('  serve  --port 8080 '), ['serve', '--port', '8080']);
});

test('splitArgs returns an empty list for blank input', () => {
    assert.deepEqual(splitArgs('   '), []);
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
