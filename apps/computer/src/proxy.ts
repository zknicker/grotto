export interface LoopbackProxy {
    close(): void;
    sendCount(): number;
    url: string;
}

/**
 * The per-launch loopback proxy. The Agent authenticates to it with a local-only
 * token; the proxy forwards `/api/agent/*` to the hosted Server with the scoped
 * runner credential. The runner credential never leaves this process, so the
 * Agent can act as itself without ever holding Server-valid authority.
 */
export function startLoopbackProxy(input: {
    proxyToken: string;
    runnerToken: string;
    serverOrigin: string;
}): LoopbackProxy {
    let sends = 0;
    const server = Bun.serve({
        fetch: async (request) => {
            const url = new URL(request.url);
            if (!url.pathname.startsWith('/api/agent/')) {
                return new Response('Not found', { status: 404 });
            }
            if (!isAuthorized(request, input.proxyToken)) {
                return new Response('Unauthorized', { status: 401 });
            }
            const body = await request.text();
            const upstream = await fetch(new URL(url.pathname, input.serverOrigin), {
                body: request.method === 'GET' ? undefined : body,
                headers: {
                    authorization: `Bearer ${input.runnerToken}`,
                    'content-type': request.headers.get('content-type') ?? 'application/json',
                },
                method: request.method,
            });
            if (upstream.ok && url.pathname === '/api/agent/messages/send') {
                sends += 1;
            }
            return new Response(await upstream.text(), {
                headers: { 'content-type': 'application/json' },
                status: upstream.status,
            });
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    return {
        close: () => server.stop(true),
        sendCount: () => sends,
        url: `http://127.0.0.1:${server.port}`,
    };
}

function isAuthorized(request: Request, proxyToken: string): boolean {
    const header = request.headers.get('authorization');
    return header === `Bearer ${proxyToken}`;
}
