// A local HTTP MCP server the scenarios fully control: fixtures are defined per
// record key, and every tools/call is logged, so an MCP scenario can gate on
// whether the private lookup actually happened — not on model prose. Ported
// from the Playwright agent-e2e support lane.

import { createServer } from 'node:http';

export async function startControlledMcp() {
    /** @type {Array<{ key: string }>} */
    const calls = [];
    /** @type {Map<string, { owner: string, title: string }>} */
    const records = new Map();

    const server = createServer(async (request, response) => {
        if (request.method !== 'POST') {
            response.writeHead(405).end();
            return;
        }

        const message = JSON.parse(await readBody(request));
        if (message.method === 'notifications/initialized') {
            response.writeHead(202).end();
            return;
        }

        const result =
            message.method === 'initialize'
                ? {
                      capabilities: { tools: {} },
                      protocolVersion: message.params?.protocolVersion,
                      serverInfo: { name: 'Agent Test Audit Ledger', version: '1.0.0' },
                  }
                : message.method === 'tools/list'
                  ? { tools: [lookupTool] }
                  : lookupResult(message, records, calls);

        response
            .writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify({ id: message.id, jsonrpc: '2.0', result }));
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Controlled MCP did not bind a TCP port.');
    }

    return {
        calls,
        // Bun's `closeAllConnections` already stops the listener, so an
        // already-stopped server is a clean shutdown here, not a failure.
        close: async () => {
            server.closeAllConnections();
            if (!server.listening) {
                return;
            }
            await new Promise((resolve, reject) =>
                server.close((error) =>
                    error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve()
                )
            );
        },
        define: (key, record) => records.set(key, record),
        url: `http://127.0.0.1:${address.port}/mcp`,
    };
}

const lookupTool = {
    description:
        'Look up one private audit record by its exact key. Use this whenever the user asks about an Audit Ledger record.',
    inputSchema: {
        additionalProperties: false,
        properties: { key: { type: 'string' } },
        required: ['key'],
        type: 'object',
    },
    name: 'lookup_audit_record',
};

function lookupResult(message, records, calls) {
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

async function readBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}
