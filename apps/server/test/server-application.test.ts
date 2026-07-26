import { afterEach, expect, test } from 'bun:test';
import { WebSocket } from 'ws';
import { type ServerTestHarness, startServerTestHarness } from './server-harness.ts';

const appOrigin = 'https://app.grotto.test';
let harness: ServerTestHarness | null = null;
let activeSocket: WebSocket | null = null;

afterEach(async () => {
    activeSocket?.terminate();
    activeSocket = null;
    await harness?.close();
    harness = null;
});

test('serves health through the Server application', async () => {
    const url = await startServer();

    const response = await fetch(new URL('/healthz', url));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
});

test('serves tRPC procedures through the Server application', async () => {
    const url = await startServer();

    const response = await fetch(new URL('/trpc/identity.me', url));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
        result: {
            data: null,
        },
    });
});

test('accepts WebSocket connections from the configured app origin', async () => {
    const url = await startServer();

    activeSocket = createSocket(new URL('/trpc', url), appOrigin);
    await waitForSocketOpen(activeSocket);

    expect(activeSocket.readyState).toBe(WebSocket.OPEN);
    await closeSocket(activeSocket);
    expect(activeSocket.readyState).toBe(WebSocket.CLOSED);
    activeSocket = null;
});

test('rejects WebSocket connections from other origins', async () => {
    const url = await startServer();
    activeSocket = createSocket(new URL('/trpc', url), 'https://malicious.example');

    await expect(waitForSocketOpen(activeSocket)).rejects.toThrow();
});

test('closes active WebSocket connections during application shutdown', async () => {
    const url = await startServer();
    activeSocket = createSocket(new URL('/trpc', url), appOrigin);
    await waitForSocketOpen(activeSocket);
    const closed = waitForSocketClose(activeSocket);

    await harness?.close();
    harness = null;

    await closed;
    expect(activeSocket.readyState).toBe(WebSocket.CLOSED);
    activeSocket = null;
});

async function startServer() {
    harness = await startServerTestHarness({ appOrigin });
    return harness.url;
}

function createSocket(url: URL, origin: string) {
    const socketUrl = new URL(url);
    socketUrl.protocol = 'ws:';
    return new WebSocket(socketUrl, {
        headers: {
            Origin: origin,
        },
    });
}

function waitForSocketOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.terminate();
            reject(new Error('Timed out waiting for WebSocket connection.'));
        }, 1000);
        socket.once('open', () => {
            clearTimeout(timeout);
            resolve();
        });
        socket.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

function closeSocket(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.once('close', () => resolve());
        socket.once('error', reject);
        socket.close();
    });
}

function waitForSocketClose(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.once('close', () => resolve());
        socket.once('error', reject);
    });
}
