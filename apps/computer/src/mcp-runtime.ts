import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

export interface AttachmentMcpConnection {
    args: string[];
    command: string | null;
    env: Record<string, string>;
    headers: Record<string, string>;
    id: string;
    name: string;
    url: string | null;
}

interface Grant {
    agentId: string;
    connectionId: string;
    toolName: string;
}

/**
 * MCP credentials, clients, discovered tools, and grants are all namespaced by
 * one attachment root. Nothing in this class can resolve another Server's
 * connection id.
 */
export class AttachmentMcpRuntime {
    private readonly clients = new Map<string, Promise<MCPClient>>();
    private readonly grants = new Set<string>();

    constructor(private readonly root: string) {}

    async upsert(connection: AttachmentMcpConnection): Promise<void> {
        await mkdir(this.root, { mode: 0o700, recursive: true });
        await this.closeConnection(connection.id);
        const destination = this.path(connection.id);
        const temporary = `${destination}.tmp`;
        await writeFile(temporary, `${JSON.stringify(connection)}\n`, { mode: 0o600 });
        await rename(temporary, destination);
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
        const client = await this.client(connectionId);
        return (await client.listTools()).tools.map((tool) => tool.name);
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
        const transport = connection.command
            ? new Experimental_StdioMCPTransport({
                  args: connection.args,
                  command: connection.command,
                  env: connection.env,
              })
            : {
                  headers: connection.headers,
                  redirect: 'error' as const,
                  type: 'http' as const,
                  url: requireValue(connection.url, 'URL'),
              };
        return await createMCPClient({ clientName: 'Grotto Computer', transport });
    }

    private async readConnection(connectionId: string): Promise<AttachmentMcpConnection> {
        let raw: string;
        try {
            raw = await readFile(this.path(connectionId), 'utf8');
        } catch {
            throw new Error('MCP connection does not belong to this attachment.');
        }
        return JSON.parse(raw) as AttachmentMcpConnection;
    }

    private async closeConnection(connectionId: string): Promise<void> {
        const pending = this.clients.get(connectionId);
        this.clients.delete(connectionId);
        await pending?.then((client) => client.close()).catch(() => undefined);
    }

    private path(connectionId: string): string {
        if (!/^mcp_[A-Za-z0-9_-]{16}$/u.test(connectionId)) {
            throw new Error('Invalid MCP connection id.');
        }
        return join(this.root, `${connectionId}.json`);
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
