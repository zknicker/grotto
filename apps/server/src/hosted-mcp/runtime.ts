import { createHash } from 'node:crypto';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentMcpConnectionGrantsTable,
    mcpConnectionsTable,
    mcpSecretsTable,
} from '../postgres/schema.ts';
import { createHostedMcpOAuthProvider } from './oauth.ts';
import { secureMcpFetch } from './secure-fetch.ts';

export interface HostedMcpSecret {
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

export interface HostedMcpToolDefinition {
    description: string;
    inputSchema: Record<string, unknown>;
    name: string;
    title: string | null;
}

/** Server-owned remote MCP clients, credentials, discovery, and invocation. */
export class HostedMcpRuntime {
    private readonly clients = new Map<string, Promise<MCPClient>>();

    constructor(private readonly db: GrottoDatabase) {}

    async discover(connectionId: string) {
        const client = await this.client(connectionId);
        const definitions = await listAllTools(client);
        return {
            accountLabel: client.serverInfo.name,
            tools: definitions.map((tool) => tool.name),
        };
    }

    async listAgentTools(serverId: string, agentId: string): Promise<HostedMcpToolDefinition[]> {
        const connections = await this.grantedConnections(serverId, agentId);
        const definitions = await Promise.all(
            connections.map(async (connection) => {
                try {
                    const tools = await listAllTools(await this.client(connection.id));
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
        const tools = await (await this.client(resolved.connectionId)).tools();
        const tool = tools[resolved.upstreamName];
        if (!tool?.execute) {
            throw new Error(`MCP tool ${resolved.upstreamName} is unavailable.`);
        }
        await this.requireGrant(input.serverId, input.agentId, resolved.connectionId);
        return await tool.execute(input.args, {
            context: undefined,
            messages: [],
            toolCallId: 'hosted-mcp',
        });
    }

    async closeConnection(connectionId: string): Promise<void> {
        const pending = this.clients.get(connectionId);
        this.clients.delete(connectionId);
        await pending?.then((client) => client.close()).catch(() => undefined);
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

    async readSecret(connectionId: string): Promise<HostedMcpSecret> {
        const [row] = await this.db
            .select({ secret: mcpSecretsTable.secret })
            .from(mcpSecretsTable)
            .where(eq(mcpSecretsTable.connectionId, connectionId))
            .limit(1);
        return (row?.secret as unknown as HostedMcpSecret | undefined) ?? emptySecret();
    }

    async writeSecret(connectionId: string, secret: HostedMcpSecret): Promise<void> {
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
                        ? await createHostedMcpOAuthProvider(
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
            .select({ id: mcpConnectionsTable.id, name: mcpConnectionsTable.name })
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
            throw new Error('Access to this MCP server was revoked.');
        }
    }

    private async resolveGrantedTool(serverId: string, agentId: string, visibleName: string) {
        const connections = await this.grantedConnections(serverId, agentId);
        for (const connection of connections) {
            const tools = await listAllTools(await this.client(connection.id)).catch(() => []);
            const tool = tools.find(
                (item) => modelToolName(connection.id, item.name) === visibleName
            );
            if (tool) {
                return { connectionId: connection.id, upstreamName: tool.name };
            }
        }
        throw new Error(`MCP tool ${visibleName} is not granted.`);
    }
}

export function emptySecret(): HostedMcpSecret {
    return { approvedAuthorizationServerOrigins: [], headers: {}, oauthScopes: [] };
}

function modelToolName(connectionId: string, toolName: string) {
    const slug = (value: string) =>
        value.replace(/[^a-zA-Z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, '') || 'tool';
    const hash = createHash('sha256')
        .update(`${connectionId}\0${toolName}`)
        .digest('hex')
        .slice(0, 8);
    return `mcp__${slug(connectionId).slice(0, 20)}__${slug(toolName).slice(0, 27)}_${hash}`;
}

async function listAllTools(client: MCPClient) {
    const tools: Awaited<ReturnType<MCPClient['listTools']>>['tools'] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page += 1) {
        const result = await client.listTools({ params: { cursor } });
        tools.push(...result.tools);
        if (tools.length > 1000) {
            throw new Error('MCP tool discovery exceeded 1,000 tools.');
        }
        if (!result.nextCursor) {
            return tools;
        }
        if (seenCursors.has(result.nextCursor)) {
            throw new Error('MCP tool discovery returned a repeated cursor.');
        }
        seenCursors.add(result.nextCursor);
        cursor = result.nextCursor;
    }
    throw new Error('MCP tool discovery exceeded 100 pages.');
}
