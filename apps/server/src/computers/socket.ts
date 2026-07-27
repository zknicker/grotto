import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computerHandshakeSchema } from './contracts.ts';
import { hashComputerSecret, markComputerOffline, reportComputerHandshake } from './service.ts';

const helloSchema = z
    .object({ credential: z.string().min(32), type: z.literal('hello') })
    .extend(computerHandshakeSchema.shape)
    .strict();

/** The only Server-to-Computer transport: one authenticated outbound socket per Computer. */
export function startComputerAttachmentSocket(server: Server, db: GrottoDatabase) {
    const sockets = new Map<string, import('ws').WebSocket>();
    const socketServer = new WebSocketServer({ noServer: true });
    const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (path !== '/computer/attachment') {
            return;
        }
        socketServer.handleUpgrade(request, socket, head, (connection) => {
            socketServer.emit('connection', connection);
        });
    };
    server.on('upgrade', onUpgrade);
    socketServer.on('connection', (socket) => {
        let computerId: string | null = null;
        socket.once('message', async (raw) => {
            try {
                const hello = helloSchema.parse(JSON.parse(raw.toString()));
                const computer = await reportComputerHandshake(
                    db,
                    hashComputerSecret(hello.credential),
                    hello
                );
                if (sockets.has(computer.id)) {
                    socket.close(4409, 'A Computer may have one attachment socket.');
                    return;
                }
                computerId = computer.id;
                sockets.set(computer.id, socket);
                socket.send(JSON.stringify({ computerId: computer.id, type: 'accepted' }));
            } catch {
                socket.close(4403, 'Computer credential was rejected.');
            }
        });
        socket.on('close', () => {
            if (computerId) {
                sockets.delete(computerId);
                void markComputerOffline(db, computerId);
            }
        });
    });
    return {
        close: () => {
            server.off('upgrade', onUpgrade);
            for (const socket of sockets.values()) socket.close(1001, 'Server shutting down');
            socketServer.close();
        },
    };
}
