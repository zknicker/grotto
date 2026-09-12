'use strict';

const { describe, expect, test } = require('bun:test');
const { isSsoCallbackUrl } = require('./clerk-auth.cjs');

describe('desktop OAuth callback URLs', () => {
    test('accepts the canonical Haus callback', () => {
        expect(isSsoCallbackUrl('haus://sso-callback?rotating_token_nonce=nonce')).toBe(true);
    });

    test('accepts a process-owned development loopback callback', () => {
        expect(
            isSsoCallbackUrl(
                `http://127.0.0.1:43123/sso-callback/${'a'.repeat(48)}?rotating_token_nonce=nonce`
            )
        ).toBe(true);
    });

    test('rejects unrelated schemes and routes', () => {
        expect(isSsoCallbackUrl('https://haus.chat/sso-callback')).toBe(false);
        expect(isSsoCallbackUrl('http://localhost:43123/sso-callback/token')).toBe(false);
        expect(isSsoCallbackUrl('haus://settings')).toBe(false);
    });
});
