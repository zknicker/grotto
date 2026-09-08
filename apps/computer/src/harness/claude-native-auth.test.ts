import { expect, test } from 'bun:test';
import { claudeNativeEnvironment } from './claude-native-auth.ts';

test('hands the current native login to an isolated Claude process without copying its credential document', async () => {
    let accessToken = 'test-native-token';
    const options = {
        environment: {},
        loadCredentials: async () => ({
            credentials: {
                accessToken,
                expiresAt: null,
                refreshToken: 'test-refresh',
                subscriptionType: 'max',
            },
            document: { private: 'host-only' },
            path: null,
            source: 'keychain' as const,
        }),
    };
    expect(await claudeNativeEnvironment(options)).toEqual({
        CLAUDE_CODE_OAUTH_TOKEN: accessToken,
    });
    accessToken = 'test-refreshed-token';
    expect(await claudeNativeEnvironment(options)).toEqual({
        CLAUDE_CODE_OAUTH_TOKEN: accessToken,
    });
});

test('missing native login fails with a recovery instruction before Claude starts', async () => {
    await expect(
        claudeNativeEnvironment({ environment: {}, loadCredentials: async () => null })
    ).rejects.toThrow('Sign in to Claude Code on this Computer, then retry the Agent.');
});

test('preserves native API-key authentication without loading an unrelated subscription', async () => {
    expect(
        await claudeNativeEnvironment({
            environment: { ANTHROPIC_API_KEY: 'test-api-key' },
            loadCredentials: () => {
                throw new Error('Must not load OAuth credentials');
            },
        })
    ).toEqual({});
});
