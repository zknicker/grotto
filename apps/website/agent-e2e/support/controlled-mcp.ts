import { createServer } from 'node:http';

interface LookupCall {
    key: string;
}

export async function startControlledMcp() {
    const calls: LookupCall[] = [];
    const records = new Map<string, { owner: string; title: string }>();
    const server = createServer(async (request, response) => {
        if (request.method !== 'POST') {
            response.writeHead(405).end();
            return;
        }

        const message = JSON.parse(await readBody(request)) as {
            id?: number;
            method: string;
            params?: {
                arguments?: { key?: string };
                protocolVersion?: string;
            };
        };
        if (message.method === 'notifications/initialized') {
            response.writeHead(202).end();
            return;
        }

        const result =
            message.method === 'initialize'
                ? {
                      capabilities: { tools: {} },
                      protocolVersion: message.params?.protocolVersion,
                      serverInfo: { name: 'Agent E2E Audit Ledger', version: '1.0.0' },
                  }
                : message.method === 'tools/list'
                  ? {
                        tools: [
                            {
                                description:
                                    'Look up one private audit record by its exact key. Use this whenever the user asks about an Audit Ledger record.',
                                inputSchema: {
                                    additionalProperties: false,
                                    properties: { key: { type: 'string' } },
                                    required: ['key'],
                                    type: 'object',
                                },
                                name: 'lookup_audit_record',
                            },
                        ],
                    }
                  : lookupResult(message, records, calls);

        response
            .writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify({ id: message.id, jsonrpc: '2.0', result }));
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Controlled MCP did not bind a TCP port.');
    }

    return {
        calls,
        close: async () => {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            );
        },
        define: (key: string, record: { owner: string; title: string }) => records.set(key, record),
        url: `http://127.0.0.1:${address.port}/mcp`,
    };
}

function lookupResult(
    message: {
        method: string;
        params?: { arguments?: { key?: string } };
    },
    records: Map<string, { owner: string; title: string }>,
    calls: LookupCall[]
) {
    if (message.method !== 'tools/call') {
        return null;
    }

    const key = message.params?.arguments?.key ?? '';
    calls.push({ key });
    const record = records.get(key);
    return {
        content: [
            {
                text: record
                    ? JSON.stringify({ key, ...record })
                    : JSON.stringify({ error: 'not_found', key }),
                type: 'text',
            },
        ],
    };
}

async function readBody(request: AsyncIterable<Uint8Array>) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of request) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}
