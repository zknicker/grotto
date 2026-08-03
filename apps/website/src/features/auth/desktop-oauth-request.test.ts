import { describe, expect, it } from 'bun:test';
import { desktopGoogleOAuthRequest, getDesktopOAuthCallbackUrl } from './desktop-oauth-request.ts';

describe('desktopGoogleOAuthRequest', () => {
    it('uses the callback owned by the running desktop shell', () => {
        expect(desktopGoogleOAuthRequest('http://127.0.0.1:43123/sso-callback/token')).toEqual({
            redirectUrl: 'http://127.0.0.1:43123/sso-callback/token',
            strategy: 'oauth_google',
        });
    });

    it('keeps older packaged shells on the canonical Grotto callback', async () => {
        expect(await getDesktopOAuthCallbackUrl({})).toBe('grotto://sso-callback');
    });

    it('uses a callback prepared by a current development shell', async () => {
        expect(
            await getDesktopOAuthCallbackUrl({
                prepareSsoCallback: async () =>
                    'http://127.0.0.1:43123/sso-callback/development-token',
            })
        ).toBe('http://127.0.0.1:43123/sso-callback/development-token');
    });
});
