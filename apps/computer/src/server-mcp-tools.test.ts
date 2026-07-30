import { afterEach, expect, test } from 'bun:test';
import type { ToolSet } from '@ai-sdk/provider-utils';
import { createServerMcpTools } from './server-mcp-tools.ts';

let server: ReturnType<typeof Bun.serve> | undefined;

afterEach(() => {
    server?.stop(true);
    server = undefined;
});

test('preserves Server MCP denial and upstream failure codes through tool execution', async () => {
    let response = { code: 'MCP_DENIED', message: 'Access was revoked.', status: 403 };
    server = Bun.serve({
        fetch: async (request) => {
            const url = new URL(request.url);
            if (url.pathname === '/api/agent/mcp/tools') {
                return Response.json({
                    tools: [
                        {
                            description: 'Exercise error propagation.',
                            inputSchema: { properties: {}, type: 'object' },
                            name: 'mcp__fixture__fail',
                            title: null,
                        },
                    ],
                });
            }
            return Response.json(
                { code: response.code, message: response.message },
                { status: response.status }
            );
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    const tools = await createServerMcpTools({
        proxyToken: 'runner-token',
        proxyUrl: `http://127.0.0.1:${server.port}`,
    });

    for (const expected of [
        { code: 'MCP_DENIED', message: 'Access was revoked.', status: 403 },
        { code: 'MCP_TIMEOUT', message: 'The MCP invocation timed out.', status: 504 },
        {
            code: 'MCP_AUTH_REQUIRED',
            message: 'Reconnect this MCP connection before using it.',
            status: 502,
        },
        { code: 'MCP_UNAVAILABLE', message: 'The MCP invocation is unavailable.', status: 502 },
    ]) {
        response = expected;
        const invocation = execute(tools, 'mcp__fixture__fail');
        await expect(invocation).rejects.toMatchObject(expected);
    }
});

async function execute(tools: ToolSet, name: string) {
    return await tools[name]?.execute?.(
        {},
        {
            abortSignal: new AbortController().signal,
            context: undefined,
            messages: [],
            toolCallId: 'mcp-error-test',
        }
    );
}
