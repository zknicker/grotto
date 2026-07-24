import { createHash } from 'node:crypto';
import { type ListToolsResult, type MCPClient, UnauthorizedError } from '@ai-sdk/mcp';
import { jsonSchema, type ToolExecutionOptions, type ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeMcpTool } from '@tavern/api';
import {
    closeAllMcpClients,
    closeMcpClientsForAgent,
    closeMcpClientsForConnection,
    createMcpClientForConnection,
    executeAgentMcpTool,
    listAllToolDefinitions,
    toolsForAgentMcpSession,
} from './mcp-client-pool.ts';
import {
    getMcpConnection,
    hasAgentMcpToolGrant,
    listAgentMcpToolGrants,
} from './mcp-connections.ts';
import { auditErrorType, auditMcpToolCall } from './mcp-tool-audit.ts';

export {
    closeAllMcpClients,
    closeMcpClientsForAgent,
    closeMcpClientsForConnection,
    listAllToolDefinitions,
    auditErrorType,
};

export async function createAgentMcpTools(input: {
    agentId: string;
    turnId: string;
}): Promise<ToolSet> {
    const tools: ToolSet = {};
    const grants = listAgentMcpToolGrants(input.agentId);
    const grantsByConnection = new Map<string, typeof grants>();
    for (const grant of grants) {
        grantsByConnection.set(grant.connectionId, [
            ...(grantsByConnection.get(grant.connectionId) ?? []),
            grant,
        ]);
    }

    for (const [connectionId, connectionGrants] of grantsByConnection) {
        const connection = getMcpConnection(connectionId);
        if (!connection) {
            continue;
        }
        if (!connection.api.connected) {
            addUnavailableTools(tools, {
                connectionGrants,
                connectionId,
                connectionName: connection.api.name,
                message: 'Reconnect it in Settings → Connections.',
            });
            continue;
        }
        let upstreamTools: Awaited<ReturnType<MCPClient['tools']>>;
        try {
            upstreamTools = await toolsForAgentMcpSession(input.agentId, connectionId);
        } catch (error) {
            addUnavailableTools(tools, {
                connectionGrants,
                connectionId,
                connectionName: connection.api.name,
                message: error instanceof Error ? error.message : String(error),
            });
            continue;
        }
        for (const grant of connectionGrants) {
            const upstream = upstreamTools[grant.toolName];
            if (!upstream?.execute) {
                addUnavailableTools(tools, {
                    connectionGrants: [grant],
                    connectionId,
                    connectionName: connection.api.name,
                    message: 'The server no longer advertises this tool.',
                });
                continue;
            }
            const visibleName = modelToolName(connectionId, grant.toolName);
            tools[visibleName] = {
                ...upstream,
                description: upstream.description ?? `Run ${grant.toolName} through MCP.`,
                execute: async (toolInput: unknown, options: ToolExecutionOptions<unknown>) => {
                    if (!hasAgentMcpToolGrant(input.agentId, connectionId, grant.toolName)) {
                        throw new Error(
                            `Access to ${connection.api.name} tool ${grant.toolName} was revoked.`
                        );
                    }
                    return await auditMcpToolCall(
                        {
                            agentId: input.agentId,
                            connectionId,
                            toolName: grant.toolName,
                            turnId: input.turnId,
                        },
                        async () =>
                            await executeAgentMcpTool(toolInput, options, {
                                agentId: input.agentId,
                                connectionId,
                                toolName: grant.toolName,
                            })
                    );
                },
            } as unknown as ToolSet[string];
        }
    }
    return tools;
}

export async function listLiveMcpTools(connectionId: string): Promise<AgentRuntimeMcpTool[]> {
    const connection = getMcpConnection(connectionId);
    if (connection?.api.auth === 'oauth' && !connection.api.connected) {
        throw new UnauthorizedError('Connect this MCP server before listing tools.');
    }
    const client = await createMcpClientForConnection(connectionId);
    try {
        const result = await listAllToolDefinitions(client);
        return result.tools.map(toApiTool);
    } finally {
        await client.close();
    }
}

export async function testMcpConnection(connectionId: string) {
    try {
        return { error: null, ok: true, tools: await listLiveMcpTools(connectionId) };
    } catch (error) {
        return {
            error:
                error instanceof UnauthorizedError
                    ? 'Connect this MCP server before testing it.'
                    : error instanceof Error
                      ? error.message
                      : String(error),
            ok: false,
            tools: [],
        };
    }
}

function modelToolName(connectionId: string, toolName: string) {
    const connection = slug(connectionId).slice(0, 20);
    const tool = slug(toolName).slice(0, 27);
    const hash = createHash('sha256')
        .update(`${connectionId}\0${toolName}`)
        .digest('hex')
        .slice(0, 8);
    return `mcp__${connection}__${tool}_${hash}`;
}

function slug(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, '') || 'tool';
}

function toApiTool(tool: ListToolsResult['tools'][number]): AgentRuntimeMcpTool {
    return {
        ...(tool.annotations ? { annotations: tool.annotations as Record<string, unknown> } : {}),
        description: tool.description ?? '',
        name: tool.name,
        title: tool.title ?? null,
    };
}

function addUnavailableTools(
    tools: ToolSet,
    input: {
        connectionGrants: ReturnType<typeof listAgentMcpToolGrants>;
        connectionId: string;
        connectionName: string;
        message: string;
    }
) {
    for (const grant of input.connectionGrants) {
        tools[modelToolName(input.connectionId, grant.toolName)] = {
            description: `${input.connectionName} tool ${grant.toolName} is currently unavailable: ${input.message}`,
            execute: async () => {
                throw new Error(`${input.connectionName} is unavailable. ${input.message}`);
            },
            inputSchema: jsonSchema({
                additionalProperties: true,
                type: 'object',
            }),
        };
    }
}
