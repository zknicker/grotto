import { afterEach, expect, test } from 'bun:test';
import type { AddressInfo } from 'node:net';
import { createServer, type Server as NetServer } from 'node:net';
import type { Server } from 'bun';
import { startLoopbackProxy } from './proxy.ts';

const servers: Server<unknown>[] = [];
const netServers: NetServer[] = [];

afterEach(() => {
    for (const server of servers.splice(0)) {
        server.stop(true);
    }
    for (const server of netServers.splice(0)) {
        server.close();
    }
});

test('the loopback proxy forwards inbox reads to the canonical Server ledger', async () => {
    const requested: string[] = [];
    const upstream = Bun.serve({
        fetch(request) {
            requested.push(new URL(request.url).pathname);
            return Response.json({ messages: [], more: false });
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    servers.push(upstream);
    const proxy = startLoopbackProxy({
        proxyToken: 'local-token',
        runnerToken: 'runner-token',
        serverOrigin: `http://127.0.0.1:${upstream.port}`,
    });
    try {
        const headers = { authorization: 'Bearer local-token' };
        expect((await fetch(`${proxy.url}/api/agent/inbox`, { headers })).status).toBe(200);
        expect((await fetch(`${proxy.url}/api/agent/events`, { headers })).status).toBe(200);
        expect(requested).toEqual(['/api/agent/inbox', '/api/agent/events']);
    } finally {
        proxy.close();
    }
});

test('the loopback proxy preserves Agent API query parameters', async () => {
    let upstreamUrl = '';
    const upstream = Bun.serve({
        fetch(request) {
            upstreamUrl = request.url;
            return Response.json({ ok: true });
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    servers.push(upstream);
    const proxy = startLoopbackProxy({
        proxyToken: 'local-token',
        runnerToken: 'runner-token',
        serverOrigin: `http://127.0.0.1:${upstream.port}`,
    });
    try {
        const response = await fetch(`${proxy.url}/api/agent/history?target=%23general&limit=25`, {
            headers: { authorization: 'Bearer local-token' },
        });
        expect(response.status).toBe(200);
        expect(new URL(upstreamUrl).search).toBe('?target=%23general&limit=25');
    } finally {
        proxy.close();
    }
});

test('counts only committed messages as produced output', async () => {
    let state: 'held' | 'sent' = 'held';
    const upstream = Bun.serve({
        fetch() {
            return Response.json({ state });
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    servers.push(upstream);
    const proxy = startLoopbackProxy({
        proxyToken: 'local-token',
        runnerToken: 'runner-token',
        serverOrigin: `http://127.0.0.1:${upstream.port}`,
    });
    try {
        const request = () =>
            fetch(`${proxy.url}/api/agent/messages/send`, {
                body: '{}',
                headers: {
                    authorization: 'Bearer local-token',
                    'content-type': 'application/json',
                },
                method: 'POST',
            });
        expect((await request()).status).toBe(200);
        expect(proxy.sendCount()).toBe(0);

        state = 'sent';
        expect((await request()).status).toBe(200);
        expect(proxy.sendCount()).toBe(1);
    } finally {
        proxy.close();
    }
});

test('counts a send whose upstream response is lost after connection', async () => {
    const upstream = createServer((socket) => {
        socket.once('data', () => socket.destroy());
    });
    netServers.push(upstream);
    const upstreamPort = await listen(upstream);
    const proxy = startLoopbackProxy({
        proxyToken: 'local-token',
        runnerToken: 'runner-token',
        serverOrigin: `http://127.0.0.1:${upstreamPort}`,
    });
    try {
        expect((await sendThrough(proxy.url)).status).toBe(502);
        expect(proxy.sendCount()).toBe(1);
    } finally {
        proxy.close();
    }
});

test('does not count a send rejected before an upstream connection', async () => {
    const unavailable = createServer();
    const upstreamPort = await listen(unavailable);
    await new Promise<void>((resolve, reject) => {
        unavailable.close((error) => (error ? reject(error) : resolve()));
    });
    netServers.splice(netServers.indexOf(unavailable), 1);
    const proxy = startLoopbackProxy({
        proxyToken: 'local-token',
        runnerToken: 'runner-token',
        serverOrigin: `http://127.0.0.1:${upstreamPort}`,
    });
    try {
        expect((await sendThrough(proxy.url)).status).toBe(502);
        expect(proxy.sendCount()).toBe(0);
    } finally {
        proxy.close();
    }
});

async function listen(server: NetServer): Promise<number> {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    return (server.address() as AddressInfo).port;
}

function sendThrough(proxyUrl: string) {
    return fetch(`${proxyUrl}/api/agent/messages/send`, {
        body: '{}',
        headers: {
            authorization: 'Bearer local-token',
            'content-type': 'application/json',
        },
        method: 'POST',
    });
}
