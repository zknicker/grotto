'use strict';

const { describe, expect, test } = require('bun:test');
const { createLoopbackSsoCallback } = require('./clerk-loopback-callback.cjs');

describe('createLoopbackSsoCallback', () => {
    test('returns Clerk callbacks only to the process that prepared them', async () => {
        let receivedCallback = null;
        const callback = createLoopbackSsoCallback((url) => {
            receivedCallback = url;
        });
        const redirectUrl = await callback.prepare();
        const response = await fetch(`${redirectUrl}?rotating_token_nonce=nonce_123`);

        expect(response.status).toBe(200);
        expect(await response.text()).toContain('Return to Grotto');
        expect(receivedCallback).toBe(`${redirectUrl}?rotating_token_nonce=nonce_123`);

        await callback.close();
    });
});
