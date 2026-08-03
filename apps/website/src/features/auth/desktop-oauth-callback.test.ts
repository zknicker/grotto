import { describe, expect, it } from 'bun:test';
import {
    getDesktopOAuthReloadOptions,
    waitForDesktopOAuthCallback,
} from './desktop-oauth-callback.ts';

describe('getDesktopOAuthReloadOptions', () => {
    it('reads the Clerk rotating token nonce from a desktop callback', () => {
        expect(
            getDesktopOAuthReloadOptions(
                'grotto://sso-callback?created_session_id=sess_123&rotating_token_nonce=nonce_456'
            )
        ).toEqual({ rotatingTokenNonce: 'nonce_456' });
    });

    it('reloads the client-bound attempt when Clerk returns an empty callback', () => {
        expect(getDesktopOAuthReloadOptions('grotto://sso-callback')).toEqual({});
    });
});

describe('waitForDesktopOAuthCallback', () => {
    it('unsubscribes when the desktop sign-in is canceled', async () => {
        const controller = new AbortController();
        let callback: ((url: string) => void) | undefined;
        let unsubscribed = false;
        const pending = waitForDesktopOAuthCallback({
            onCallback: async () => undefined,
            signal: controller.signal,
            subscribe: (listener) => {
                callback = listener;
                return () => {
                    unsubscribed = true;
                };
            },
        });

        controller.abort();

        expect(callback).toBeDefined();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(unsubscribed).toBe(true);
    });
});
