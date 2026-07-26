import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { applyWSSHandler, type CreateWSSContextFnOptions } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import type { GrottoContext } from './context.ts';
import { grottoRouter } from './router.ts';

const trpcWebSocketPath = '/trpc';

interface GrottoWebSocketServerOptions {
    createContext(opts: CreateWSSContextFnOptions): GrottoContext;
    isAllowedOrigin(origin: string | undefined): boolean;
}

export function startGrottoWebSocketServer(server: Server, options: GrottoWebSocketServerOptions) {
    const wss = new WebSocketServer({
        noServer: true,
    });
    let isClosing = false;

    const handler = applyWSSHandler({
        createContext: options.createContext,
        router: grottoRouter,
        wss,
    });

    const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (!(request.url && isTrpcWebSocketRequest(request.url))) {
            return;
        }

        if (isClosing) {
            socket.destroy();
            return;
        }

        if (!options.isAllowedOrigin(request.headers.origin)) {
            socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            return;
        }

        try {
            wss.handleUpgrade(request, socket, head, (webSocket) => {
                wss.emit('connection', webSocket, request);
            });
        } catch {
            socket.destroy();
        }
    };

    server.on('upgrade', handleUpgrade);

    return {
        broadcastReconnectNotification() {
            handler.broadcastReconnectNotification();
        },
        close() {
            isClosing = true;
            server.off('upgrade', handleUpgrade);
            for (const client of wss.clients) {
                client.terminate();
            }
            wss.close();
        },
    };
}

function isTrpcWebSocketRequest(requestUrl: string) {
    try {
        return new URL(requestUrl, 'http://localhost').pathname === trpcWebSocketPath;
    } catch {
        return false;
    }
}
