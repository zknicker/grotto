import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { hostedAgentEffectiveStateSchema, hostedComputerInventorySchema } from '@tavern/api';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { recordAgentEffectiveState } from '../hosted-agents/record-agent-effective-state.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computerHandshakeSchema } from './contracts.ts';
import {
    hashComputerSecret,
    markComputerOffline,
    recordComputerInventory,
    reportComputerHandshake,
} from './service.ts';

const helloSchema = z
    .object({
        credential: z.string().min(32),
        inventory: hostedComputerInventorySchema.optional(),
        type: z.literal('hello'),
    })
    .extend(computerHandshakeSchema.shape)
    .strict();

/** Ongoing report of last-reported inventory and per-Agent effective state. */
const reportSchema = z
    .object({
        agents: z.array(hostedAgentEffectiveStateSchema).max(500).default([]),
        inventory: hostedComputerInventorySchema.optional(),
        type: z.literal('report'),
    })
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
        socket.on('message', async (raw) => {
            if (computerId) {
                await ingestReport(db, computerId, raw.toString());
                return;
            }
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
                if (hello.inventory) {
                    await recordComputerInventory(db, computer.id, hello.inventory);
                }
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
            for (const socket of sockets.values()) {
                socket.close(1001, 'Server shutting down');
            }
            socketServer.close();
        },
    };
}

async function ingestReport(db: GrottoDatabase, computerId: string, raw: string) {
    let report: z.infer<typeof reportSchema>;
    try {
        report = reportSchema.parse(JSON.parse(raw));
    } catch {
        return;
    }
    if (report.inventory) {
        await recordComputerInventory(db, computerId, report.inventory);
    }
    if (report.agents.length > 0) {
        await recordAgentEffectiveState(db, computerId, report.agents);
    }
}
