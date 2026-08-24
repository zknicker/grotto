import { describe, expect, mock, test } from 'bun:test';
import { appProtocolVersion } from '@grotto/api';
import type { GrottoContext } from '../context.ts';
import { createRouter } from '../trpc.ts';
import { createClerkSignInTokenProcedure } from './create-clerk-sign-in-token.ts';

const localContext = {
    appProtocol: {
        productVersion: 'test',
        protocolVersion: appProtocolVersion,
    },
    requestHost: 'localhost:8080',
} as GrottoContext;

interface DependencyOverrides {
    clerkSecretKey?: string;
    devClerkSignInUserId?: string;
    nodeEnvironment?: string;
}

function createCaller(overrides: DependencyOverrides = {}) {
    const fetch = mock(async () => Response.json({ token: 'ticket_test' }));
    const router = createRouter({
        createClerkSignInToken: createClerkSignInTokenProcedure(() => ({
            clerkSecretKey: 'sk_test',
            devClerkSignInUserId: 'user_test',
            fetch,
            nodeEnvironment: 'development',
            ...overrides,
        })),
    });

    return { caller: router.createCaller(localContext), fetch };
}

describe('dev.createClerkSignInToken', () => {
    test('rejects production', async () => {
        const { caller, fetch } = createCaller({ nodeEnvironment: 'production' });

        await expect(caller.createClerkSignInToken()).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    test('rejects missing Clerk configuration', async () => {
        const { caller, fetch } = createCaller({ clerkSecretKey: undefined });

        await expect(caller.createClerkSignInToken()).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    test('rejects a non-localhost request host', async () => {
        const { fetch } = createCaller();
        const router = createRouter({
            createClerkSignInToken: createClerkSignInTokenProcedure(() => ({
                clerkSecretKey: 'sk_test',
                devClerkSignInUserId: 'user_test',
                fetch,
                nodeEnvironment: 'development',
            })),
        });
        const caller = router.createCaller({
            ...localContext,
            requestHost: 'grotto.example.com',
        });

        await expect(caller.createClerkSignInToken()).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    test('mints a 60-second ticket for the configured dev user', async () => {
        const { caller, fetch } = createCaller();

        await expect(caller.createClerkSignInToken()).resolves.toEqual({ ticket: 'ticket_test' });
        expect(fetch).toHaveBeenCalledWith(
            'https://api.clerk.com/v1/sign_in_tokens',
            expect.objectContaining({
                body: JSON.stringify({ expires_in_seconds: 60, user_id: 'user_test' }),
                headers: {
                    Authorization: 'Bearer sk_test',
                    'Content-Type': 'application/json',
                },
                method: 'POST',
            })
        );
    });
});
