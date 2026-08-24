import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentMcpConnectionGrantsTable,
    mcpConnectionsTable,
    mcpSecretsTable,
} from '../postgres/schema.ts';
import { classifyMcpUpstreamError, McpDeniedError, withMcpTimeout } from './errors.ts';
import { createMcpOAuthProvider } from './oauth.ts';
import { secureMcpFetch } from './secure-fetch.ts';
import { listAllTools, modelToolName } from './tool-catalog.ts';

const DEFAULT_DISCOVERY_TIMEOUT_MS = 5000;
const DEFAULT_INVOCATION_TIMEOUT_MS = 30_000;

export interface McpSecret {
    approvedAuthorizationServerOrigins: string[];
    authorizationServerInformation?: Record<string, unknown>;
    clientInformation?: Record<string, unknown>;
    configuredClientInformation?: Record<string, unknown>;
    headers: Record<string, string>;
    oauthScopes: string[];
    oauthState?: string;
    redirectUrl?: string;
    tokens?: Record<string, unknown>;
    verifier?: string;
}

export interface McpToolDefinition {
    description: string;
    inputSchema: Record<string, unknown>;
    name: string;
    title: string | null;
}

interface McpRuntimeOptions {
    discoveryTimeoutMs?: number;
    invocationTimeoutMs?: number;
}

/** Server-owned remote MCP clients, credentials, discovery, and invocation. */
export class McpRuntime {
    private readonly clients = new Map<string, Promise<MCPClient>>();
    private readonly discoveryTimeoutMs: number;
    private readonly invocationTimeoutMs: number;

    constructor(
        private readonly db: GrottoDatabase,
        options: McpRuntimeOptions = {}
    ) {
        this.discoveryTimeoutMs = options.discoveryTimeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
        this.invocationTimeoutMs = options.invocationTimeoutMs ?? DEFAULT_INVOCATION_TIMEOUT_MS;
    }

    async discover(connectionId: string) {
        return await this.runUpstream(connectionId, 'discovery', async () => {
            const client = await this.client(connectionId);
            const definitions = await listAllTools(client);
            return {
                accountLabel: client.serverInfo.name,
                // SEP-973 icons ride in serverInfo. The SDK parses that object
                // with a passthrough schema, so the field survives even though
                // its declared type stops at name/version/title.
                instructions: client.instructions,
                serverInfoIcons: (client.serverInfo as { icons?: unknown }).icons,
                tools: definitions.map((tool) => tool.name),
            };
        });
    }

    async listAgentTools(serverId: string, agentId: string): Promise<McpToolDefinition[]> {
        const connections = await this.grantedConnections(serverId, agentId);
        const definitions = await Promise.all(
            connections.map(async (connection) => {
                try {
                    const tools = await this.runUpstream(connection.id, 'discovery', async () =>
                        listAllTools(await this.client(connection.id))
                    );
                    return tools.map((tool) => ({
                        description:
                            tool.description ?? `Run ${tool.name} through ${connection.name}.`,
                        inputSchema: tool.inputSchema as Record<string, unknown>,
                        name: modelToolName(connection.id, tool.name),
                        title: tool.annotations?.title ?? null,
                    }));
                } catch {
                    return [];
                }
            })
        );
        return definitions.flat();
    }

    async invoke(input: {
        agentId: string;
        args: unknown;
        serverId: string;
        toolName: string;
    }): Promise<unknown> {
        const resolved = await this.resolveGrantedTool(
            input.serverId,
            input.agentId,
            input.toolName
        );
        await this.requireGrant(input.serverId, input.agentId, resolved.connectionId);
        return await this.runUpstream(resolved.connectionId, 'invocation', async () => {
            const client = await this.client(resolved.connectionId);
            return await client.callTool({
                arguments: asMcpArguments(input.args),
                name: resolved.upstreamName,
                options: { timeout: this.invocationTimeoutMs },
            });
        });
    }

    async closeConnection(connectionId: string): Promise<void> {
        const pending = this.clients.get(connectionId);
        this.clients.delete(connectionId);
        if (!pending) {
            return;
        }
        await withMcpTimeout(
            pending.then((client) => client.close()),
            this.discoveryTimeoutMs,
            'discovery'
        ).catch(() => undefined);
    }

    async close(): Promise<void> {
        const pending = [...this.clients.values()];
        this.clients.clear();
        await Promise.allSettled(pending.map(async (client) => (await client).close()));
    }

    async readConnection(connectionId: string) {
        const [connection] = await this.db
            .select()
            .from(mcpConnectionsTable)
            .where(eq(mcpConnectionsTable.id, connectionId))
            .limit(1);
        if (!connection) {
            throw new Error('MCP connection was not found.');
        }
        return connection;
    }

    async readSecret(connectionId: string): Promise<McpSecret> {
        const [row] = await this.db
            .select({ secret: mcpSecretsTable.secret })
            .from(mcpSecretsTable)
            .where(eq(mcpSecretsTable.connectionId, connectionId))
            .limit(1);
        return (row?.secret as unknown as McpSecret | undefined) ?? emptySecret();
    }

    async writeSecret(connectionId: string, secret: McpSecret): Promise<void> {
        await this.db
            .insert(mcpSecretsTable)
            .values({ connectionId, secret: secret as unknown as Record<string, unknown> })
            .onConflictDoUpdate({
                set: {
                    secret: secret as unknown as Record<string, unknown>,
                    updatedAt: new Date(),
                },
                target: mcpSecretsTable.connectionId,
            });
    }

    private async client(connectionId: string): Promise<MCPClient> {
        const existing = this.clients.get(connectionId);
        if (existing) {
            return await existing;
        }
        const pending = this.createClient(connectionId);
        this.clients.set(connectionId, pending);
        try {
            return await pending;
        } catch (cause) {
            this.clients.delete(connectionId);
            throw cause;
        }
    }

    private async createClient(connectionId: string): Promise<MCPClient> {
        const connection = await this.readConnection(connectionId);
        const secret = await this.readSecret(connectionId);
        return await createMCPClient({
            clientName: 'Grotto Server',
            transport: {
                authProvider:
                    connection.auth === 'oauth'
                        ? await createMcpOAuthProvider(
                              this,
                              connectionId,
                              secret.redirectUrl ?? 'http://127.0.0.1/mcp/oauth/callback',
                              {
                                  allowAuthorizationServerOrigin: false,
                                  onRedirect() {
                                      throw new Error('Reconnect this MCP server in Grotto.');
                                  },
                              }
                          )
                        : undefined,
                fetch: secureMcpFetch,
                headers: secret.headers,
                redirect: 'error',
                type: 'http',
                url: connection.url,
            },
        });
    }

    private async grantedConnections(serverId: string, agentId: string) {
        return await this.db
            .select({
                id: mcpConnectionsTable.id,
                name: mcpConnectionsTable.name,
                tools: mcpConnectionsTable.tools,
            })
            .from(agentMcpConnectionGrantsTable)
            .innerJoin(
                mcpConnectionsTable,
                and(
                    eq(mcpConnectionsTable.serverId, agentMcpConnectionGrantsTable.serverId),
                    eq(mcpConnectionsTable.id, agentMcpConnectionGrantsTable.connectionId)
                )
            )
            .where(
                and(
                    eq(agentMcpConnectionGrantsTable.serverId, serverId),
                    eq(agentMcpConnectionGrantsTable.agentId, agentId),
                    eq(mcpConnectionsTable.connected, true)
                )
            );
    }

    private async requireGrant(serverId: string, agentId: string, connectionId: string) {
        const [grant] = await this.db
            .select({ connectionId: agentMcpConnectionGrantsTable.connectionId })
            .from(agentMcpConnectionGrantsTable)
            .where(
                and(
                    eq(agentMcpConnectionGrantsTable.serverId, serverId),
                    eq(agentMcpConnectionGrantsTable.agentId, agentId),
                    eq(agentMcpConnectionGrantsTable.connectionId, connectionId)
                )
            )
            .limit(1);
        if (!grant) {
            throw new McpDeniedError('Access to this MCP connection was revoked.');
        }
    }

    private async resolveGrantedTool(serverId: string, agentId: string, visibleName: string) {
        const connections = await this.grantedConnections(serverId, agentId);
        for (const connection of connections) {
            const upstreamName = connection.tools.find(
                (toolName) => modelToolName(connection.id, toolName) === visibleName
            );
            if (upstreamName) {
                return { connectionId: connection.id, upstreamName };
            }
        }
        throw new McpDeniedError(`MCP tool ${visibleName} is not granted.`);
    }

    private async runUpstream<T>(
        connectionId: string,
        operation: 'discovery' | 'invocation',
        run: () => Promise<T>
    ): Promise<T> {
        const timeoutMs =
            operation === 'discovery' ? this.discoveryTimeoutMs : this.invocationTimeoutMs;
        try {
            return await withMcpTimeout(run(), timeoutMs, operation);
        } catch (cause) {
            this.discardClient(connectionId);
            throw classifyMcpUpstreamError(cause, operation);
        }
    }

    private discardClient(connectionId: string) {
        const pending = this.clients.get(connectionId);
        this.clients.delete(connectionId);
        void pending?.then((client) => client.close()).catch(() => undefined);
    }
}

export function emptySecret(): McpSecret {
    return { approvedAuthorizationServerOrigins: [], headers: {}, oauthScopes: [] };
}

function asMcpArguments(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    throw new McpDeniedError('MCP tool arguments must be an object.');
}
