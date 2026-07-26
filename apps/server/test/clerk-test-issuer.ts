import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, type KeyObject, SignJWT } from 'jose';

/**
 * Serves a JWKS the hosted Server can verify against, so tests exercise real
 * Clerk session-token verification instead of stubbing the identity boundary.
 */
export interface ClerkTestIssuer {
    close(): Promise<void>;
    /** A session token whose lifetime has already run out. */
    mintExpiredSessionToken(clerkUserId: string): Promise<string>;
    /** Extra claims let tests prove Clerk Organization claims carry no authority. */
    mintSessionToken(clerkUserId: string, claims?: Record<string, unknown>): Promise<string>;
    url: string;
}

const keyId = 'grotto-test-key';
const tokenLifetimeSeconds = 300;
const expiredTokenAgeSeconds = 600;

export async function startClerkTestIssuer(): Promise<ClerkTestIssuer> {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
    const jwk = await exportJWK(publicKey as KeyObject);
    const jwks = JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', kid: keyId, use: 'sig' }] });

    const server = createServer((request, response) => {
        if (request.url === '/.well-known/jwks.json') {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(jwks);
            return;
        }

        response.writeHead(404);
        response.end();
    });

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}`;

    return {
        close: () =>
            new Promise<void>((resolve) => {
                server.closeAllConnections();
                server.close(() => resolve());
            }),
        mintExpiredSessionToken(clerkUserId) {
            const expiredAt = Math.floor(Date.now() / 1000) - expiredTokenAgeSeconds;

            return new SignJWT({})
                .setProtectedHeader({ alg: 'RS256', kid: keyId })
                .setIssuer(url)
                .setSubject(clerkUserId)
                .setIssuedAt(expiredAt - tokenLifetimeSeconds)
                .setExpirationTime(expiredAt)
                .sign(privateKey);
        },
        mintSessionToken(clerkUserId, claims = {}) {
            return new SignJWT(claims)
                .setProtectedHeader({ alg: 'RS256', kid: keyId })
                .setIssuer(url)
                .setSubject(clerkUserId)
                .setIssuedAt()
                .setExpirationTime(`${tokenLifetimeSeconds}s`)
                .sign(privateKey);
        },
        url,
    };
}
