'use strict';

const { describe, expect, test } = require('bun:test');
const { isSsoCallbackUrl } = require('./clerk-auth.cjs');

describe('desktop OAuth callback URLs', () => {
    test('accepts the canonical Grotto callback', () => {
        expect(isSsoCallbackUrl('grotto://sso-callback?rotating_token_nonce=nonce')).toBe(true);
    });

    test('accepts a process-owned development loopback callback', () => {
        expect(
            isSsoCallbackUrl(
                `http://127.0.0.1:43123/sso-callback/${'a'.repeat(48)}?rotating_token_nonce=nonce`
            )
        ).toBe(true);
    });

    test('rejects the retired Tavern callback', () => {
        expect(isSsoCallbackUrl('tavern://sso-callback?rotating_token_nonce=nonce')).toBe(false);
    });

    test('rejects unrelated schemes and routes', () => {
        expect(isSsoCallbackUrl('https://grotto.sh/sso-callback')).toBe(false);
        expect(isSsoCallbackUrl('http://localhost:43123/sso-callback/token')).toBe(false);
        expect(isSsoCallbackUrl('grotto://settings')).toBe(false);
    });
});
