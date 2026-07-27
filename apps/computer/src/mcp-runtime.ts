import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import {
    type AttachmentMcpSecret,
    type AttachmentOAuthStartResult,
    completeAttachmentMcpOAuth,
    createAttachmentOAuthProvider,
    startAttachmentMcpOAuth,
} from './mcp-oauth.ts';
import { secureMcpFetch } from './mcp-secure-fetch.ts';
import { AttachmentMcpStorage } from './mcp-storage.ts';

export interface AttachmentMcpConnection {
    args: string[];
    auth: 'headers' | 'none' | 'oauth';
    command: string | null;
    env: Record<string, string>;
    headers: Record<string, string>;
    id: string;
    name: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthScopes: string[];
    preset: 'google-calendar' | 'merchbase' | null;
    url: string | null;
}

export interface StoredAttachmentMcpConnection {
    args: string[];
    auth: AttachmentMcpConnection['auth'];
    command: string | null;
    id: string;
    name: string;
    oauthClientId?: string;
    oauthScopes: string[];
    preset: AttachmentMcpConnection['preset'];
    url: string | null;
}

interface Grant {
    agentId: string;
    connectionId: string;
    toolName: string;
}

export interface AttachmentMcpDiscovery {
    accountLabel: string;
    tools: string[];
}

/**
 * MCP credentials, clients, discovered tools, and grants are all namespaced by
 * one attachment root. Nothing in this class can resolve another Server's
 * connection id.
 */
export class AttachmentMcpRuntime {
    private readonly clients = new Map<string, Promise<MCPClient>>();
    private readonly grants = new Set<string>();
    private readonly storage: AttachmentMcpStorage;

    constructor(root: string) {
        this.storage = new AttachmentMcpStorage(root);
    }

    async upsert(connection: AttachmentMcpConnection): Promise<void> {
        await this.closeConnection(connection.id);
        await this.storage.save(connection);
    }

    replaceAgentGrants(agentId: string, grants: Grant[]): void {
        for (const key of this.grants) {
            if (key.startsWith(`${agentId}\0`)) {
                this.grants.delete(key);
            }
        }
        for (const grant of grants) {
            if (grant.agentId === agentId) {
                this.grants.add(grantKey(grant.agentId, grant.connectionId, grant.toolName));
            }
        }
    }

    replaceAllGrants(grants: Grant[]): void {
        this.grants.clear();
        for (const grant of grants) {
            this.grants.add(grantKey(grant.agentId, grant.connectionId, grant.toolName));
        }
    }

    setGrant(grant: Grant & { enabled: boolean }): void {
        const key = grantKey(grant.agentId, grant.connectionId, grant.toolName);
        if (grant.enabled) {
            this.grants.add(key);
        } else {
            this.grants.delete(key);
        }
    }

    async listTools(connectionId: string): Promise<string[]> {
        return (await this.discover(connectionId)).tools;
    }

    async discover(connectionId: string): Promise<AttachmentMcpDiscovery> {
        const client = await this.client(connectionId);
        return {
            accountLabel: client.serverInfo.name,
            tools: (await client.listTools()).tools.map((tool) => tool.name),
        };
    }

    async isConnected(connectionId: string): Promise<boolean> {
        const connection = await this.readConnection(connectionId);
        if (connection.auth === 'none') {
            return true;
        }
        const secret = await this.readSecret(connectionId);
        return connection.auth === 'headers'
            ? Object.keys(secret.headers).length > 0
            : Boolean(secret.tokens);
    }

    async startOAuth(input: {
        allowAuthorizationServerOrigin: boolean;
        connectionId: string;
        redirectUrl: string;
        routingState: string;
    }): Promise<AttachmentOAuthStartResult> {
        await this.closeConnection(input.connectionId);
        const result = await startAttachmentMcpOAuth(this, input);
        if (result.status === 'ready') {
            this.clearConnectionGrants(input.connectionId);
        }
        return result;
    }

    async completeOAuth(input: {
        code: string;
        connectionId: string;
        redirectUrl: string;
        state: string;
    }): Promise<AttachmentMcpDiscovery> {
        await completeAttachmentMcpOAuth(this, input);
        await this.closeConnection(input.connectionId);
        return await this.discover(input.connectionId);
    }

    async disconnect(connectionId: string): Promise<void> {
        await this.closeConnection(connectionId);
        await this.storage.deleteSecret(connectionId);
        for (const key of this.grants) {
            if (key.includes(`\0${connectionId}\0`)) {
                this.grants.delete(key);
            }
        }
    }

    async replaceHeaders(connectionId: string, headers: Record<string, string>): Promise<void> {
        const connection = await this.readConnection(connectionId);
        if (connection.auth !== 'headers') {
            throw new Error('This MCP connection does not use header credentials.');
        }
        await this.closeConnection(connectionId);
        const secret = await this.readSecret(connectionId);
        await this.writeSecret(connectionId, { ...secret, headers });
        this.clearConnectionGrants(connectionId);
    }

    async delete(connectionId: string): Promise<void> {
        await this.disconnect(connectionId);
        await this.storage.deleteConnection(connectionId);
    }

    private clearConnectionGrants(connectionId: string): void {
        for (const key of this.grants) {
            if (key.includes(`\0${connectionId}\0`)) {
                this.grants.delete(key);
            }
        }
    }

    async invoke(input: {
        agentId: string;
        args: unknown;
        connectionId: string;
        toolName: string;
    }): Promise<unknown> {
        // Deliberately immediately before touching the upstream client.
        if (!this.grants.has(grantKey(input.agentId, input.connectionId, input.toolName))) {
            throw new Error(`MCP tool ${input.toolName} is not granted.`);
        }
        const client = await this.client(input.connectionId);
        const tools = await client.tools();
        const tool = tools[input.toolName];
        if (!tool?.execute) {
            throw new Error(`MCP tool ${input.toolName} is unavailable.`);
        }
        if (!this.grants.has(grantKey(input.agentId, input.connectionId, input.toolName))) {
            throw new Error(`MCP tool ${input.toolName} grant was revoked.`);
        }
        return await tool.execute(input.args, {
            context: undefined,
            messages: [],
            toolCallId: 'hosted-mcp',
        });
    }

    async close(): Promise<void> {
        const clients = [...this.clients.values()];
        this.clients.clear();
        await Promise.allSettled(clients.map(async (client) => (await client).close()));
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
        } catch (error) {
            this.clients.delete(connectionId);
            throw error;
        }
    }

    private async createClient(connectionId: string): Promise<MCPClient> {
        const connection = await this.readConnection(connectionId);
        const secret = await this.readSecret(connectionId);
        const transport = connection.command
            ? new Experimental_StdioMCPTransport({
                  args: connection.args,
                  command: connection.command,
                  env: secret.env,
              })
            : {
                  authProvider:
                      connection.auth === 'oauth'
                          ? await createAttachmentOAuthProvider(
                                this,
                                connection.id,
                                secret.redirectUrl ?? 'http://127.0.0.1/mcp/oauth/callback',
                                {
                                    allowAuthorizationServerOrigin: false,
                                    onRedirect() {
                                        throw new Error(
                                            'Reconnect this MCP connection in the App.'
                                        );
                                    },
                                }
                            )
                          : undefined,
                  fetch: secureMcpFetch,
                  headers: secret.headers,
                  redirect: 'error' as const,
                  type: 'http' as const,
                  url: requireValue(connection.url, 'URL'),
              };
        return await createMCPClient({ clientName: 'Grotto Computer', transport });
    }

    async readConnection(connectionId: string): Promise<StoredAttachmentMcpConnection> {
        return await this.storage.readConnection(connectionId);
    }

    async readSecret(connectionId: string): Promise<AttachmentMcpSecret> {
        return await this.storage.readSecret(connectionId);
    }

    async writeSecret(connectionId: string, secret: AttachmentMcpSecret): Promise<void> {
        await this.storage.writeSecret(connectionId, secret);
    }

    private async closeConnection(connectionId: string): Promise<void> {
        const pending = this.clients.get(connectionId);
        this.clients.delete(connectionId);
        await pending?.then((client) => client.close()).catch(() => undefined);
    }
}

function grantKey(agentId: string, connectionId: string, toolName: string): string {
    return `${agentId}\0${connectionId}\0${toolName}`;
}

function requireValue(value: string | null, label: string): string {
    if (!value) {
        throw new Error(`MCP connection ${label} is missing.`);
    }
    return value;
}
