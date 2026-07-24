import { auth } from '@ai-sdk/mcp';
import type {
    AgentRuntimeMcpOAuthComplete,
    AgentRuntimeMcpOAuthStart,
    AgentRuntimeMcpOAuthStartResult,
} from '@tavern/api';
import {
    assertSecureOrLoopbackUrl,
    createOAuthProvider,
    requireOAuthConnection,
    resetMcpOAuthFlowCredentials,
    secureMcpFetch,
} from './mcp-oauth-provider.ts';

export { createOAuthProvider, resetMcpOAuthFlowCredentials, secureMcpFetch };

export async function startMcpOAuth(
    connectionId: string,
    input: AgentRuntimeMcpOAuthStart,
    afterCredentialsReset: () => Promise<void> = async () => undefined
): Promise<AgentRuntimeMcpOAuthStartResult> {
    const connection = requireOAuthConnection(connectionId);
    assertSecureOrLoopbackUrl(input.redirectUrl, 'OAuth redirect');
    resetMcpOAuthFlowCredentials(connectionId);
    await afterCredentialsReset();
    let authorizationUrl: string | null = null;
    const provider = createOAuthProvider(connectionId, input.redirectUrl, {
        allowAuthorizationServerOrigin: input.allowAuthorizationServerOrigin,
        onRedirect(url) {
            authorizationUrl = url.toString();
        },
    });
    const result = await auth(provider, {
        fetchFn: secureMcpFetch,
        serverUrl: requireUrl(connection.api.url),
    });
    if (result !== 'REDIRECT' || !authorizationUrl) {
        throw new Error('The MCP authorization server did not return an authorization URL.');
    }
    return {
        authorizationServerOrigin: new URL(authorizationUrl).origin,
        authorizationUrl,
    };
}

export async function completeMcpOAuth(connectionId: string, input: AgentRuntimeMcpOAuthComplete) {
    const connection = requireOAuthConnection(connectionId);
    const provider = createOAuthProvider(connectionId, input.redirectUrl, {
        allowAuthorizationServerOrigin: false,
        onRedirect() {
            throw new Error('The MCP server requested a new authorization flow.');
        },
    });
    const result = await auth(provider, {
        authorizationCode: input.code,
        callbackState: input.state,
        fetchFn: secureMcpFetch,
        serverUrl: requireUrl(connection.api.url),
    });
    if (result !== 'AUTHORIZED') {
        throw new Error('MCP authorization did not complete.');
    }
}

function requireUrl(value: string | null) {
    if (!value) {
        throw new Error('MCP connection URL is missing.');
    }
    return value;
}
