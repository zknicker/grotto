import { randomBytes } from 'node:crypto';
import type {
    OAuthAuthorizationServerInformation,
    OAuthClientInformation,
    OAuthClientMetadata,
    OAuthClientProvider,
    OAuthTokens,
} from '@ai-sdk/mcp';
import { getRequiredGoogleOAuthCredentials } from './google-oauth-credentials.ts';
import {
    getMcpConnection,
    readMcpSecret,
    type StoredMcpSecret,
    writeMcpSecret,
} from './mcp-connections.ts';

export function createOAuthProvider(
    connectionId: string,
    redirectUrl: string,
    options: {
        allowAuthorizationServerOrigin: boolean;
        onRedirect(url: URL): void;
    }
): OAuthClientProvider {
    const connection = requireOAuthConnection(connectionId);
    assertSecureOrLoopbackUrl(redirectUrl, 'OAuth redirect');
    const trustedOrigins = trustedAuthorizationServerOrigins(connection);

    return {
        authorizationServerInformation() {
            const information = readMcpSecret(connectionId)
                .authorizationServerInformation as unknown as
                | OAuthAuthorizationServerInformation
                | undefined;
            if (information) {
                validateAuthorizationServerInformation(information);
            }
            return information;
        },
        async clientInformation() {
            const secret = readMcpSecret(connectionId);
            const configured = secret.configuredClientInformation;
            if (configured) {
                return configured as OAuthClientInformation;
            }
            const existing = secret.clientInformation;
            if (existing) {
                return existing as OAuthClientInformation;
            }
            if (connection.api.preset !== 'google-calendar') {
                return undefined;
            }
            const credentials = getRequiredGoogleOAuthCredentials();
            const client = {
                client_id: credentials.clientId,
                client_secret: credentials.clientSecret,
            };
            updateSecret(connectionId, { clientInformation: client });
            return client;
        },
        get clientMetadata(): OAuthClientMetadata {
            const configured = readMcpSecret(connectionId).configuredClientInformation;
            const configuredSecret =
                configured && typeof configured.client_secret === 'string'
                    ? configured.client_secret
                    : undefined;
            const configuredScopes = readMcpSecret(connectionId).oauthScopes;
            return {
                client_name: 'Grotto',
                client_uri: 'https://grotto.sh',
                grant_types: ['authorization_code', 'refresh_token'],
                redirect_uris: [redirectUrl],
                response_types: ['code'],
                ...(connection.api.preset === 'google-calendar'
                    ? { scope: 'https://www.googleapis.com/auth/calendar' }
                    : connection.api.preset === 'merchbase'
                      ? { scope: 'openid profile email' }
                      : configuredScopes.length > 0
                        ? { scope: configuredScopes.join(' ') }
                        : {}),
                token_endpoint_auth_method:
                    connection.api.preset === 'google-calendar' || configuredSecret
                        ? 'client_secret_basic'
                        : 'none',
            };
        },
        async codeVerifier() {
            const verifier = readMcpSecret(connectionId).verifier;
            if (!verifier) {
                throw new Error('MCP OAuth verifier was not found.');
            }
            return verifier;
        },
        get redirectUrl() {
            return redirectUrl;
        },
        async redirectToAuthorization(url) {
            options.onRedirect(url);
        },
        async saveAuthorizationServerInformation(value) {
            validateAuthorizationServerInformation(value);
            updateSecret(connectionId, {
                authorizationServerInformation: value as unknown as Record<string, unknown>,
            });
        },
        async saveClientInformation(value) {
            updateSecret(connectionId, {
                clientInformation: value as unknown as Record<string, unknown>,
            });
        },
        async saveCodeVerifier(verifier) {
            updateSecret(connectionId, { verifier });
        },
        async saveState(state) {
            updateSecret(connectionId, { oauthState: state });
        },
        async saveTokens(tokens) {
            updateSecret(connectionId, {
                tokens: tokens as unknown as Record<string, unknown>,
            });
        },
        async state() {
            return randomBytes(24).toString('base64url');
        },
        async storedState() {
            return readMcpSecret(connectionId).oauthState;
        },
        async tokens() {
            return readMcpSecret(connectionId).tokens as OAuthTokens | undefined;
        },
        async validateAuthorizationServerURL(_serverUrl, authorizationServerUrl) {
            assertSecureOrLoopbackUrl(
                authorizationServerUrl.toString(),
                'OAuth authorization server'
            );
            const origin = new URL(authorizationServerUrl).origin;
            if (trustedOrigins.has(origin)) {
                return;
            }
            if (options.allowAuthorizationServerOrigin) {
                updateSecret(connectionId, {
                    approvedAuthorizationServerOrigins: [
                        ...new Set([
                            ...(readMcpSecret(connectionId).approvedAuthorizationServerOrigins ??
                                []),
                            origin,
                        ]),
                    ],
                });
                return;
            }
            throw new Error(
                `The MCP server uses ${origin} for authorization. Confirm this origin before continuing.`
            );
        },
        async validateResourceURL(serverUrl, resource) {
            const expected = new URL(serverUrl);
            const actual = new URL(resource ?? expected);
            if (actual.origin !== expected.origin) {
                throw new Error('The MCP resource indicator must match the server origin.');
            }
            return actual;
        },
        async invalidateCredentials(scope) {
            const secret = readMcpSecret(connectionId);
            updateSecret(connectionId, {
                ...(scope === 'all' || scope === 'client' ? { clientInformation: undefined } : {}),
                ...(scope === 'all' || scope === 'tokens' ? { tokens: undefined } : {}),
                ...(scope === 'all' || scope === 'verifier' ? { verifier: undefined } : {}),
            });
            if (scope === 'all') {
                writeMcpSecret(connectionId, {
                    approvedAuthorizationServerOrigins: secret.approvedAuthorizationServerOrigins,
                    configuredClientInformation: secret.configuredClientInformation,
                    env: secret.env,
                    headers: secret.headers,
                    oauthScopes: secret.oauthScopes,
                });
            }
        },
    };
}

export function requireOAuthConnection(connectionId: string) {
    const connection = getMcpConnection(connectionId);
    if (!connection) {
        throw new Error('MCP connection was not found.');
    }
    if (connection.api.auth !== 'oauth' || connection.api.transport !== 'http') {
        throw new Error('This MCP connection does not use OAuth.');
    }
    return connection;
}

export function resetMcpOAuthFlowCredentials(connectionId: string) {
    const connection = requireOAuthConnection(connectionId);
    const secret = readMcpSecret(connectionId);
    writeMcpSecret(connectionId, {
        ...secret,
        accountLabel: undefined,
        ...(connection.api.preset === 'google-calendar' ? {} : { clientInformation: undefined }),
        oauthState: undefined,
        tokens: undefined,
        verifier: undefined,
    });
}

export const secureMcpFetch = (async (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1]
) => {
    const url = input instanceof Request ? input.url : input.toString();
    assertSecureOrLoopbackUrl(url, 'MCP and OAuth request');
    return await globalThis.fetch(input, init);
}) as typeof globalThis.fetch;

function trustedAuthorizationServerOrigins(
    connection: NonNullable<ReturnType<typeof getMcpConnection>>
) {
    const origins =
        connection.api.preset === 'google-calendar'
            ? ['https://accounts.google.com', 'https://oauth2.googleapis.com']
            : [];
    return new Set([...origins, ...(connection.secret.approvedAuthorizationServerOrigins ?? [])]);
}

function updateSecret(connectionId: string, patch: Partial<StoredMcpSecret>) {
    const existing = readMcpSecret(connectionId);
    writeMcpSecret(connectionId, { ...existing, ...patch });
}

function validateAuthorizationServerInformation(value: OAuthAuthorizationServerInformation) {
    const endpoints = [value.authorizationServerUrl, value.tokenEndpoint];
    for (const endpoint of endpoints) {
        if (endpoint) {
            assertSecureOrLoopbackUrl(endpoint, 'OAuth authorization server endpoint');
        }
    }
}

export function assertSecureOrLoopbackUrl(value: string, label: string) {
    const url = new URL(value);
    if (url.username || url.password) {
        throw new Error(`${label} cannot contain user information.`);
    }
    if (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
            (url.hostname === '127.0.0.1' ||
                url.hostname === '[::1]' ||
                url.hostname === 'localhost'))
    ) {
        return;
    }
    throw new Error(`${label} must use HTTPS or a loopback HTTP URL.`);
}
