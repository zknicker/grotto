import type {
    OAuthAuthorizationServerInformation,
    OAuthClientInformation,
    OAuthClientMetadata,
    OAuthClientProvider,
    OAuthTokens,
} from '@ai-sdk/mcp';
import { auth } from '@ai-sdk/mcp';
import { readGoogleMcpOAuthClient } from './google-mcp-oauth-client.ts';
import type { AttachmentMcpRuntime } from './mcp-runtime.ts';
import { assertSecureOrLoopbackUrl, secureMcpFetch } from './mcp-secure-fetch.ts';

export interface AttachmentMcpSecret {
    approvedAuthorizationServerOrigins: string[];
    authorizationServerInformation?: Record<string, unknown>;
    clientInformation?: Record<string, unknown>;
    configuredClientInformation?: Record<string, unknown>;
    env: Record<string, string>;
    headers: Record<string, string>;
    oauthScopes: string[];
    oauthState?: string;
    redirectUrl?: string;
    tokens?: Record<string, unknown>;
    verifier?: string;
}

export type AttachmentOAuthStartResult =
    | { authorizationUrl: string; status: 'ready' }
    | { authorizationServerOrigin: string; status: 'trust-required' };

class AuthorizationOriginError extends Error {
    constructor(readonly origin: string) {
        super(`Confirm ${origin} before continuing.`);
    }
}

export async function startAttachmentMcpOAuth(
    storage: AttachmentMcpRuntime,
    input: {
        allowAuthorizationServerOrigin: boolean;
        connectionId: string;
        redirectUrl: string;
        routingState: string;
    }
): Promise<AttachmentOAuthStartResult> {
    const connection = await requireOAuthConnection(storage, input.connectionId);
    assertSecureOrLoopbackUrl(input.redirectUrl, 'OAuth redirect');
    const existing = await storage.readSecret(input.connectionId);
    await storage.writeSecret(input.connectionId, {
        ...existing,
        ...(connection.preset === 'google-calendar' ? {} : { clientInformation: undefined }),
        oauthState: undefined,
        redirectUrl: input.redirectUrl,
        tokens: undefined,
        verifier: undefined,
    });
    let authorizationUrl: string | null = null;
    const provider = await createAttachmentOAuthProvider(
        storage,
        input.connectionId,
        input.redirectUrl,
        {
            allowAuthorizationServerOrigin: input.allowAuthorizationServerOrigin,
            onRedirect(url) {
                authorizationUrl = url.toString();
            },
            routingState: input.routingState,
        }
    );
    try {
        const result = await auth(provider, {
            fetchFn: secureMcpFetch,
            serverUrl: requireUrl(connection.url),
        });
        if (result !== 'REDIRECT' || !authorizationUrl) {
            throw new Error('The MCP authorization server did not return an authorization URL.');
        }
        return { authorizationUrl, status: 'ready' };
    } catch (error) {
        if (error instanceof AuthorizationOriginError) {
            await storage.writeSecret(input.connectionId, {
                ...existing,
                approvedAuthorizationServerOrigins: (await storage.readSecret(input.connectionId))
                    .approvedAuthorizationServerOrigins,
            });
            return { authorizationServerOrigin: error.origin, status: 'trust-required' };
        }
        await storage.writeSecret(input.connectionId, existing);
        throw error;
    }
}

export async function completeAttachmentMcpOAuth(
    storage: AttachmentMcpRuntime,
    input: { code: string; connectionId: string; redirectUrl: string; state: string }
): Promise<void> {
    const connection = await requireOAuthConnection(storage, input.connectionId);
    const provider = await createAttachmentOAuthProvider(
        storage,
        input.connectionId,
        input.redirectUrl,
        {
            allowAuthorizationServerOrigin: false,
            onRedirect() {
                throw new Error('The MCP server requested a new authorization flow.');
            },
        }
    );
    const result = await auth(provider, {
        authorizationCode: input.code,
        callbackState: input.state,
        fetchFn: secureMcpFetch,
        serverUrl: requireUrl(connection.url),
    });
    if (result !== 'AUTHORIZED') {
        throw new Error('MCP authorization did not complete.');
    }
}

export async function createAttachmentOAuthProvider(
    storage: AttachmentMcpRuntime,
    connectionId: string,
    redirectUrl: string,
    options: {
        allowAuthorizationServerOrigin: boolean;
        onRedirect(url: URL): void;
        routingState?: string;
    }
): Promise<OAuthClientProvider> {
    const connection = await requireOAuthConnection(storage, connectionId);
    let secret = await storage.readSecret(connectionId);
    const trustedOrigins = new Set([
        ...(connection.preset === 'google-calendar'
            ? ['https://accounts.google.com', 'https://oauth2.googleapis.com']
            : []),
        ...secret.approvedAuthorizationServerOrigins,
    ]);
    let approvalAvailable = options.allowAuthorizationServerOrigin;
    const update = async (patch: Partial<AttachmentMcpSecret>) => {
        secret = { ...secret, ...patch };
        await storage.writeSecret(connectionId, secret);
    };
    const trustOrigin = async (url: URL) => {
        assertSecureOrLoopbackUrl(url.toString(), 'OAuth authorization server');
        if (trustedOrigins.has(url.origin)) {
            return;
        }
        if (!approvalAvailable) {
            throw new AuthorizationOriginError(url.origin);
        }
        approvalAvailable = false;
        trustedOrigins.add(url.origin);
        await update({
            approvedAuthorizationServerOrigins: [
                ...new Set([...secret.approvedAuthorizationServerOrigins, url.origin]),
            ],
        });
    };

    return {
        authorizationServerInformation() {
            return secret.authorizationServerInformation as
                | OAuthAuthorizationServerInformation
                | undefined;
        },
        async clientInformation() {
            if (secret.configuredClientInformation) {
                return secret.configuredClientInformation as OAuthClientInformation;
            }
            if (secret.clientInformation) {
                return secret.clientInformation as OAuthClientInformation;
            }
            if (connection.preset !== 'google-calendar') {
                return undefined;
            }
            const client = await readGoogleMcpOAuthClient();
            await update({ clientInformation: client });
            return client;
        },
        get clientMetadata(): OAuthClientMetadata {
            const configuredSecret = secret.configuredClientInformation?.client_secret;
            return {
                client_name: 'Grotto',
                client_uri: 'https://grotto.sh',
                grant_types: ['authorization_code', 'refresh_token'],
                redirect_uris: [redirectUrl],
                response_types: ['code'],
                ...(connection.preset === 'google-calendar'
                    ? { scope: 'https://www.googleapis.com/auth/calendar' }
                    : connection.preset === 'merchbase'
                      ? { scope: 'openid profile email' }
                      : secret.oauthScopes.length > 0
                        ? { scope: secret.oauthScopes.join(' ') }
                        : {}),
                token_endpoint_auth_method:
                    connection.preset === 'google-calendar' || typeof configuredSecret === 'string'
                        ? 'client_secret_basic'
                        : 'none',
            };
        },
        async codeVerifier() {
            if (!secret.verifier) {
                throw new Error('MCP OAuth verifier was not found.');
            }
            return secret.verifier;
        },
        get redirectUrl() {
            return redirectUrl;
        },
        async redirectToAuthorization(url) {
            await trustOrigin(url);
            options.onRedirect(url);
        },
        async saveAuthorizationServerInformation(value) {
            validateAuthorizationServerInformation(value);
            await update({
                authorizationServerInformation: value as unknown as Record<string, unknown>,
            });
        },
        async saveClientInformation(value) {
            await update({ clientInformation: value as unknown as Record<string, unknown> });
        },
        async saveCodeVerifier(verifier) {
            await update({ verifier });
        },
        async saveState(state) {
            await update({ oauthState: state });
        },
        async saveTokens(tokens) {
            await update({ tokens: tokens as unknown as Record<string, unknown> });
        },
        async state() {
            return options.routingState ?? crypto.randomUUID();
        },
        async storedState() {
            return secret.oauthState;
        },
        async tokens() {
            return secret.tokens as OAuthTokens | undefined;
        },
        async validateAuthorizationServerURL(_serverUrl, authorizationServerUrl) {
            await trustOrigin(new URL(authorizationServerUrl));
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
            if (scope === 'all') {
                await storage.writeSecret(connectionId, {
                    approvedAuthorizationServerOrigins: secret.approvedAuthorizationServerOrigins,
                    configuredClientInformation: secret.configuredClientInformation,
                    env: secret.env,
                    headers: secret.headers,
                    oauthScopes: secret.oauthScopes,
                    redirectUrl: secret.redirectUrl,
                });
                secret = await storage.readSecret(connectionId);
                return;
            }
            await update({
                ...(scope === 'client' ? { clientInformation: undefined } : {}),
                ...(scope === 'tokens' ? { tokens: undefined } : {}),
                ...(scope === 'verifier' ? { verifier: undefined } : {}),
            });
        },
    };
}

async function requireOAuthConnection(storage: AttachmentMcpRuntime, connectionId: string) {
    const connection = await storage.readConnection(connectionId);
    if (connection.auth !== 'oauth' || connection.command) {
        throw new Error('This MCP connection does not use OAuth.');
    }
    return connection;
}

function validateAuthorizationServerInformation(value: OAuthAuthorizationServerInformation) {
    for (const endpoint of [value.authorizationServerUrl, value.tokenEndpoint]) {
        if (endpoint) {
            assertSecureOrLoopbackUrl(endpoint, 'OAuth authorization server endpoint');
        }
    }
}

function requireUrl(value: string | null) {
    if (!value) {
        throw new Error('MCP connection URL is missing.');
    }
    return value;
}
