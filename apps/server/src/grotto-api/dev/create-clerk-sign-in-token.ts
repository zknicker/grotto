import { TRPCError } from '@trpc/server';
import { env } from '../../config/env.ts';
import { publicProcedure } from '../trpc.ts';

const clerkSignInTokensUrl = 'https://api.clerk.com/v1/sign_in_tokens';
const localhostHostPattern = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u;

interface ClerkSignInTokenDependencies {
    clerkSecretKey?: string;
    devClerkSignInUserId?: string;
    fetch(input: string, init: RequestInit): Promise<Response>;
    nodeEnvironment?: string;
}

function getDependencies(): ClerkSignInTokenDependencies {
    return {
        clerkSecretKey: env.CLERK_SECRET_KEY,
        devClerkSignInUserId: env.DEV_CLERK_SIGN_IN_USER_ID,
        fetch: globalThis.fetch,
        nodeEnvironment: process.env.NODE_ENV,
    };
}

export function createClerkSignInTokenProcedure(
    getProcedureDependencies: () => ClerkSignInTokenDependencies = getDependencies
) {
    return publicProcedure.mutation(async ({ ctx }) => {
        const dependencies = getProcedureDependencies();

        assertDevClerkSignInAllowed(ctx.requestHost, dependencies);

        const response = await dependencies.fetch(clerkSignInTokensUrl, {
            body: JSON.stringify({
                expires_in_seconds: 60,
                user_id: dependencies.devClerkSignInUserId,
            }),
            headers: {
                Authorization: `Bearer ${dependencies.clerkSecretKey}`,
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Clerk sign-in token request failed with status ${response.status}.`,
            });
        }

        const result: unknown = await response.json();
        if (!hasToken(result)) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Clerk sign-in token response did not include a token.',
            });
        }

        return { ticket: result.token };
    });
}

export const createClerkSignInTokenRoute = createClerkSignInTokenProcedure();

function assertDevClerkSignInAllowed(
    requestHost: string | null,
    dependencies: ClerkSignInTokenDependencies
) {
    if (dependencies.nodeEnvironment === 'production') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Dev Clerk sign-in is unavailable in production.',
        });
    }

    if (!(dependencies.clerkSecretKey && dependencies.devClerkSignInUserId)) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Dev Clerk sign-in requires CLERK_SECRET_KEY and DEV_CLERK_SIGN_IN_USER_ID.',
        });
    }

    if (!(requestHost && localhostHostPattern.test(requestHost.toLowerCase()))) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Dev Clerk sign-in is available only from localhost.',
        });
    }
}

function hasToken(value: unknown): value is { token: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'token' in value &&
        typeof value.token === 'string' &&
        value.token.length > 0
    );
}
