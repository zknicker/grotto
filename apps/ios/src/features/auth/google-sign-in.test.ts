import { describe, expect, mock, test } from 'bun:test';
import type { StartSSOFlowReturnType } from '@clerk/expo/types';
import type { WebBrowserResultType } from 'expo-web-browser';
import { startGoogleSignIn } from './google-sign-in';

const redirectUrl = 'grotto://sso-callback';

describe('startGoogleSignIn', () => {
    test('starts Google SSO and activates the created session', async () => {
        const setActive = mock(async () => undefined);
        const startSSOFlow = mock(async () =>
            result({ createdSessionId: 'session_123', setActive })
        );

        await expect(startGoogleSignIn({ redirectUrl, startSSOFlow })).resolves.toBe('complete');
        expect(startSSOFlow).toHaveBeenCalledWith({
            redirectUrl,
            strategy: 'oauth_google',
        });
        expect(setActive).toHaveBeenCalledWith({ session: 'session_123' });
    });

    test('treats a dismissed system browser as cancellation', async () => {
        const startSSOFlow = mock(async () =>
            result({
                authSessionResult: { type: 'dismiss' as WebBrowserResultType },
                createdSessionId: null,
            })
        );

        await expect(startGoogleSignIn({ redirectUrl, startSSOFlow })).resolves.toBe('canceled');
    });

    test('rejects an incomplete flow instead of leaving a false signed-in state', async () => {
        const startSSOFlow = mock(async () => result({ createdSessionId: null }));

        await expect(startGoogleSignIn({ redirectUrl, startSSOFlow })).rejects.toThrow(
            'Google sign-in did not create a Grotto session.'
        );
    });
});

function result(overrides: Partial<StartSSOFlowReturnType> = {}): StartSSOFlowReturnType {
    return {
        authSessionResult: null,
        createdSessionId: null,
        ...overrides,
    };
}
