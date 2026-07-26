import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verifies Clerk session tokens against the configured Clerk instance. Only the
 * token subject is read: it is the external reference used to find the Grotto
 * User. Clerk Organization and Clerk role claims are never inspected because
 * they carry no Grotto authority.
 */
export interface ClerkSessions {
    verify(token: string): Promise<{ clerkUserId: string }>;
}

const clockToleranceSeconds = 10;

export function createClerkSessions(issuerUrl: string): ClerkSessions {
    const issuer = new URL(issuerUrl);
    const getKey = createRemoteJWKSet(new URL('/.well-known/jwks.json', issuer));
    const expectedIssuer = issuer.origin;

    return {
        async verify(token) {
            const { payload } = await jwtVerify(token, getKey, {
                clockTolerance: clockToleranceSeconds,
                issuer: expectedIssuer,
            });

            if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
                throw new Error('Clerk session token has no subject.');
            }

            return { clerkUserId: payload.sub };
        },
    };
}
