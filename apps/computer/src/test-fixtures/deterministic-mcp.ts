#!/usr/bin/env bun
import { createInterface } from 'node:readline';

const lines = createInterface({ input: process.stdin });

lines.on('line', (line) => {
    const request = JSON.parse(line) as {
        id?: number | string;
        method?: string;
        params?: { arguments?: { value?: string } };
    };
    if (request.id === undefined) {
        return;
    }
    if (request.method === 'initialize') {
        respond(request.id, {
            capabilities: { tools: {} },
            protocolVersion: '2025-03-26',
            serverInfo: { name: 'deterministic', version: '1.0.0' },
        });
        return;
    }
    if (request.method === 'tools/list') {
        respond(request.id, {
            tools: [
                {
                    description: 'Returns the configured prefix and input.',
                    inputSchema: {
                        properties: { value: { type: 'string' } },
                        required: ['value'],
                        type: 'object',
                    },
                    name: 'echo',
                },
            ],
        });
        return;
    }
    if (request.method === 'tools/call') {
        respond(request.id, {
            content: [
                {
                    text: `${process.env.MCP_PREFIX ?? ''}:${request.params?.arguments?.value ?? ''}`,
                    type: 'text',
                },
            ],
        });
        return;
    }
    process.stdout.write(`${JSON.stringify({ error: { code: -32_601 }, id: request.id })}\n`);
});

function respond(id: number | string, result: unknown) {
    process.stdout.write(`${JSON.stringify({ id, jsonrpc: '2.0', result })}\n`);
}
