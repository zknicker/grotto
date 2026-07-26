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

export function createClerkSessions(issuerUrl: string, appOrigin: string): ClerkSessions {
    const issuer = new URL(issuerUrl);
    const getKey = createRemoteJWKSet(new URL('/.well-known/jwks.json', issuer));
    const expectedIssuer = issuer.origin;
    const expectedAuthorizedParty = new URL(appOrigin).origin;

    return {
        async verify(token) {
            const { payload } = await jwtVerify(token, getKey, {
                clockTolerance: clockToleranceSeconds,
                issuer: expectedIssuer,
            });

            // One Clerk instance signs tokens for every frontend attached to
            // it, so the issuer alone does not say the token was minted for
            // this Server's App. `azp` is the frontend that asked for it, and
            // Clerk omits it when no browser Origin took part — as with the
            // native header-authenticated desktop session. Present means it
            // must be this App's exact origin; a null, non-string, empty, or
            // foreign value all fail that comparison.
            if (payload.azp !== undefined && payload.azp !== expectedAuthorizedParty) {
                throw new Error('Clerk session token was issued for another authorized party.');
            }

            if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
                throw new Error('Clerk session token has no subject.');
            }

            return { clerkUserId: payload.sub };
        },
    };
}
