import { createMCPClient, type ListToolsResult, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { ToolExecutionOptions } from '@ai-sdk/provider-utils';
import { getMcpConnection, hasAgentMcpToolGrant } from './mcp-connections.ts';
import { createOAuthProvider, secureMcpFetch } from './mcp-oauth.ts';

const clients = new Map<string, Promise<MCPClient>>();
const clientTools = new WeakMap<MCPClient, Promise<Awaited<ReturnType<MCPClient['tools']>>>>();
const maxToolPages = 100;
const maxTools = 1000;

export async function createMcpClientForConnection(connectionId: string): Promise<MCPClient> {
    return await createClient(connectionId);
}

export async function toolsForAgentMcpSession(
    agentId: string,
    connectionId: string
): Promise<Awaited<ReturnType<MCPClient['tools']>>> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const client = await getSessionMcpClient(agentId, connectionId);
        try {
            return await toolsForClient(client);
        } catch (error) {
            if (attempt === 0 && isExpiredSessionError(error)) {
                await evictCachedClient(clientKey(agentId, connectionId), client);
                continue;
            }
            throw error;
        }
    }
    throw new Error('The MCP session could not be renewed.');
}

export async function executeAgentMcpTool(
    toolInput: unknown,
    options: ToolExecutionOptions<unknown>,
    input: { agentId: string; connectionId: string; toolName: string }
) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const client = await getSessionMcpClient(input.agentId, input.connectionId);
        try {
            const upstreamTools = await toolsForClient(client);
            const upstream = upstreamTools[input.toolName];
            if (!upstream?.execute) {
                throw new Error(`MCP tool ${input.toolName} is no longer available.`);
            }
            if (!hasAgentMcpToolGrant(input.agentId, input.connectionId, input.toolName)) {
                throw new Error(`Access to MCP tool ${input.toolName} was revoked.`);
            }
            return await upstream.execute(toolInput, options);
        } catch (error) {
            if (attempt === 0 && isExpiredSessionError(error)) {
                await evictCachedClient(clientKey(input.agentId, input.connectionId), client);
                continue;
            }
            throw error;
        }
    }
    throw new Error('The MCP session could not be renewed.');
}

export async function closeMcpClientsForConnection(connectionId: string) {
    const suffix = `:${encodeURIComponent(connectionId)}`;
    const matches = [...clients.entries()].filter(([key]) => key.endsWith(suffix));
    for (const [key, pendingClient] of matches) {
        clients.delete(key);
        await pendingClient.then((client) => client.close()).catch(() => undefined);
    }
}

export async function closeMcpClientsForAgent(agentId: string) {
    const prefix = `${encodeURIComponent(agentId)}:`;
    const matches = [...clients.entries()].filter(([key]) => key.startsWith(prefix));
    for (const [key, pendingClient] of matches) {
        clients.delete(key);
        await pendingClient.then((client) => client.close()).catch(() => undefined);
    }
}

export async function closeAllMcpClients() {
    const pending = [...clients.values()];
    clients.clear();
    await Promise.allSettled(pending.map(async (client) => (await client).close()));
}

export async function listAllToolDefinitions(client: MCPClient): Promise<ListToolsResult> {
    const tools: ListToolsResult['tools'] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    for (let pageNumber = 1; pageNumber <= maxToolPages; pageNumber += 1) {
        if (cursor) {
            if (seenCursors.has(cursor)) {
                throw new Error('The MCP server returned a repeated tools cursor.');
            }
            seenCursors.add(cursor);
        }
        const page = await client.listTools({
            params: cursor ? { cursor } : undefined,
        });
        tools.push(...page.tools);
        if (tools.length > maxTools) {
            throw new Error(`The MCP server returned more than ${maxTools} tools.`);
        }
        if (!page.nextCursor) {
            return { tools };
        }
        cursor = page.nextCursor;
    }
    throw new Error(`The MCP server returned more than ${maxToolPages} tools pages.`);
}

async function getSessionMcpClient(agentId: string, connectionId: string) {
    const key = clientKey(agentId, connectionId);
    const existing = clients.get(key);
    if (existing) {
        return await existing;
    }
    const pending = createClient(connectionId, key);
    clients.set(key, pending);
    try {
        return await pending;
    } catch (error) {
        clients.delete(key);
        throw error;
    }
}

async function createClient(connectionId: string, cacheKey?: string): Promise<MCPClient> {
    const connection = getMcpConnection(connectionId);
    if (!connection) {
        throw new Error('MCP connection was not found.');
    }
    const transport =
        connection.api.transport === 'stdio'
            ? new Experimental_StdioMCPTransport({
                  args: connection.api.args,
                  command: requireValue(connection.api.command, 'command'),
                  env: connection.secret.env,
              })
            : {
                  authProvider:
                      connection.api.auth === 'oauth'
                          ? createOAuthProvider(connectionId, 'http://127.0.0.1/mcp-callback', {
                                allowAuthorizationServerOrigin: false,
                                onRedirect() {
                                    throw new Error(
                                        'The MCP connection must be reconnected in Settings.'
                                    );
                                },
                            })
                          : undefined,
                  fetch: secureMcpFetch,
                  headers: connection.secret.headers,
                  redirect: 'error' as const,
                  onSessionExpired() {
                      if (cacheKey) {
                          void evictCachedClient(cacheKey);
                      }
                  },
                  type: 'http' as const,
                  url: requireValue(connection.api.url, 'URL'),
              };
    return await createMCPClient({
        clientName: 'Grotto',
        transport,
    });
}

function toolsForClient(client: MCPClient) {
    const existing = clientTools.get(client);
    if (existing) {
        return existing;
    }
    const pending = listAllToolDefinitions(client).then((definitions) =>
        client.toolsFromDefinitions(definitions)
    );
    clientTools.set(client, pending);
    return pending;
}

async function evictCachedClient(key: string, expectedClient?: MCPClient) {
    const pending = clients.get(key);
    if (!pending) {
        if (expectedClient) {
            await expectedClient.close().catch(() => undefined);
        }
        return;
    }
    if (expectedClient && (await pending) !== expectedClient) {
        return;
    }
    clients.delete(key);
    await pending.then((client) => client.close()).catch(() => undefined);
}

function clientKey(agentId: string, connectionId: string) {
    return `${encodeURIComponent(agentId)}:${encodeURIComponent(connectionId)}`;
}

function isExpiredSessionError(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 404 &&
        error instanceof Error &&
        error.message.includes('session expired')
    );
}

function requireValue(value: string | null, label: string) {
    if (!value) {
        throw new Error(`MCP connection ${label} is missing.`);
    }
    return value;
}
