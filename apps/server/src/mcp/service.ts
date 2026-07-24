import http from 'node:http';
import type {
    AgentRuntimeMcpConnectionCreate,
    AgentRuntimeMcpConnectionUpdate,
    AgentRuntimeMcpPresetAccountCreate,
} from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';

const oauthLoopbacks = new Map<
    string,
    { server: http.Server; timeout: ReturnType<typeof setTimeout> }
>();

export async function listMcpConnections() {
    return await withRuntime((client) => client.listMcpConnections());
}

export async function addMcpConnection(input: AgentRuntimeMcpConnectionCreate) {
    return await mutate((client) => client.addMcpConnection(input));
}

export async function addMcpPresetAccount(input: AgentRuntimeMcpPresetAccountCreate) {
    return await mutate((client) => client.addMcpPresetAccount(input));
}

export async function updateMcpConnection(
    connectionId: string,
    input: AgentRuntimeMcpConnectionUpdate
) {
    return await mutate((client) => client.updateMcpConnection(connectionId, input));
}

export async function deleteMcpConnection(connectionId: string) {
    return await mutate((client) => client.deleteMcpConnection(connectionId));
}

export async function disconnectMcpConnection(connectionId: string) {
    return await mutate((client) => client.disconnectMcpConnection(connectionId));
}

export async function testMcpConnection(connectionId: string) {
    return await withRuntime((client) => client.testMcpConnection(connectionId));
}

export async function listMcpConnectionTools(connectionId: string) {
    return await withRuntime((client) => client.listMcpConnectionTools(connectionId));
}

export async function refreshMcpConnection(connectionId: string) {
    return await withRuntime((client) => client.refreshMcpConnection(connectionId));
}

export async function listMcpAgentGrants(agentId: string) {
    return await withRuntime((client) => client.listMcpAgentGrants(agentId));
}

export async function listMcpAgentHostTools(agentId: string) {
    return await withRuntime((client) => client.listMcpAgentHostTools(agentId));
}

export async function setMcpAgentToolGrant(input: {
    agentId: string;
    connectionId: string;
    enabled: boolean;
    toolName: string;
}) {
    return await mutate((client) =>
        client.setMcpAgentToolGrant(
            input.agentId,
            input.connectionId,
            input.toolName,
            input.enabled
        )
    );
}

export async function setMcpAgentHostToolGrant(input: {
    agentId: string;
    enabled: boolean;
    toolId: 'browser' | 'web_fetch';
}) {
    return await mutate((client) =>
        client.setMcpAgentHostToolGrant(input.agentId, input.toolId, input.enabled)
    );
}

export async function startMcpConnectionOAuth(
    connectionId: string,
    allowAuthorizationServerOrigin = false
) {
    closeLoopback(connectionId);
    return await withRuntime(async (client) => {
        const server = http.createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve());
        });
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            server.close();
            throw new Error('MCP OAuth callback server did not start.');
        }
        const redirectUrl = `http://127.0.0.1:${address.port}/callback`;
        try {
            const start = await client.startMcpConnectionOAuth(connectionId, {
                allowAuthorizationServerOrigin,
                redirectUrl,
            });
            const timeout = setTimeout(() => closeLoopback(connectionId), 5 * 60 * 1000);
            oauthLoopbacks.set(connectionId, { server, timeout });
            server.on('request', (request, response) => {
                void completeOAuthCallback(connectionId, redirectUrl, request, response);
            });
            return { ...start, status: 'authorize' as const };
        } catch (error) {
            server.close();
            const origin = authorizationServerOriginFromError(error);
            if (origin && !allowAuthorizationServerOrigin) {
                return {
                    authorizationServerOrigin: origin,
                    status: 'trust-required' as const,
                };
            }
            throw error;
        }
    });
}

async function completeOAuthCallback(
    connectionId: string,
    redirectUrl: string,
    request: http.IncomingMessage,
    response: http.ServerResponse
) {
    const url = new URL(request.url ?? '/', redirectUrl);
    if (url.pathname !== '/callback') {
        response.writeHead(404).end('Not found');
        return;
    }
    try {
        const code = url.searchParams.get('code');
        if (!code) {
            throw new Error(url.searchParams.get('error') ?? 'Authorization code was missing.');
        }
        await withRuntime((client) =>
            client.completeMcpConnectionOAuth(connectionId, {
                code,
                redirectUrl,
                state: url.searchParams.get('state') ?? undefined,
            })
        );
        response
            .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
            .end('<h1>Connected</h1><p>You can close this window and return to Grotto.</p>');
    } catch (error) {
        response
            .writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
            .end(
                `<h1>Connection failed</h1><p>${escapeHtml(
                    error instanceof Error ? error.message : String(error)
                )}</p>`
            );
    } finally {
        closeLoopback(connectionId);
    }
}

async function mutate<Result>(run: (client: TavernAgentRuntimeClient) => Promise<Result>) {
    const result = await withRuntime(run);
    emitSkillInvalidationCascade();
    return result;
}

async function withRuntime<Result>(
    run: (client: TavernAgentRuntimeClient) => Promise<Result>
): Promise<Result> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Connections are unavailable while Runtime is offline.');
    }
    try {
        return await run(client);
    } finally {
        client.close();
    }
}

function closeLoopback(connectionId: string) {
    const loopback = oauthLoopbacks.get(connectionId);
    oauthLoopbacks.delete(connectionId);
    if (loopback) {
        clearTimeout(loopback.timeout);
        loopback.server.close();
    }
}

function authorizationServerOriginFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /uses (https?:\/\/[^\s]+) for authorization/u.exec(message)?.[1] ?? null;
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
