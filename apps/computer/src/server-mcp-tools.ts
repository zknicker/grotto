import { jsonSchema, type ToolSet } from '@ai-sdk/provider-utils';

interface ServerMcpTool {
    description: string;
    inputSchema: Record<string, unknown>;
    name: string;
    title: string | null;
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
        throw new Error(`Server MCP discovery failed (${response.status}).`);
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
                    message?: string;
                    result?: unknown;
                };
                if (!invocation.ok) {
                    throw new Error(result.message ?? 'Server MCP invocation failed.');
                }
                return result.result;
            },
        };
    }
    return tools;
}
