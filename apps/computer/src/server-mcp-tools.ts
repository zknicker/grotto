import { jsonSchema, type ToolSet } from '@ai-sdk/provider-utils';

interface ServerMcpTool {
    description: string;
    inputSchema: Record<string, unknown>;
    name: string;
    title: string | null;
}

export type ServerMcpErrorCode =
    | 'MCP_AUTH_REQUIRED'
    | 'MCP_DENIED'
    | 'MCP_TIMEOUT'
    | 'MCP_UNAVAILABLE';

export class ServerMcpToolError extends Error {
    constructor(
        readonly code: ServerMcpErrorCode,
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'ServerMcpToolError';
    }
}

/** Safe schemas come down from Server; execution returns through the scoped loopback proxy. */
export async function createServerMcpTools(input: {
    proxyToken: string;
    proxyUrl: string;
}): Promise<ToolSet> {
    const response = await fetch(`${input.proxyUrl}/api/agent/mcp/tools`, {
        headers: { authorization: `Bearer ${input.proxyToken}` },
    });
    if (!response.ok) {
        throw await readServerMcpError(response, 'MCP_UNAVAILABLE');
    }
    const payload = (await response.json()) as { tools?: ServerMcpTool[] };
    const tools: ToolSet = {};
    for (const definition of payload.tools ?? []) {
        tools[definition.name] = {
            description: definition.description,
            inputSchema: jsonSchema(definition.inputSchema),
            execute: async (args: unknown) => {
                const invocation = await fetch(`${input.proxyUrl}/api/agent/mcp/invoke`, {
                    body: JSON.stringify({ args, toolName: definition.name }),
                    headers: {
                        authorization: `Bearer ${input.proxyToken}`,
                        'content-type': 'application/json',
                    },
                    method: 'POST',
                });
                const result = (await invocation.json()) as {
                    code?: string;
                    message?: string;
                    result?: unknown;
                };
                if (!invocation.ok) {
                    throw new ServerMcpToolError(
                        parseServerMcpErrorCode(result.code),
                        result.message ?? 'Server MCP invocation failed.',
                        invocation.status
                    );
                }
                return result.result;
            },
        };
    }
    return tools;
}

async function readServerMcpError(
    response: Response,
    fallbackCode: ServerMcpErrorCode
): Promise<ServerMcpToolError> {
    const result = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
    } | null;
    return new ServerMcpToolError(
        parseServerMcpErrorCode(result?.code, fallbackCode),
        result?.message ?? `Server MCP request failed (${response.status}).`,
        response.status
    );
}

function parseServerMcpErrorCode(
    value: string | undefined,
    fallback: ServerMcpErrorCode = 'MCP_UNAVAILABLE'
): ServerMcpErrorCode {
    if (
        value === 'MCP_AUTH_REQUIRED' ||
        value === 'MCP_DENIED' ||
        value === 'MCP_TIMEOUT' ||
        value === 'MCP_UNAVAILABLE'
    ) {
        return value;
    }
    return fallback;
}
