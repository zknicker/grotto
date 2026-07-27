import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
    hostedAgentEffectiveStateSchema,
    hostedAgentTurnSummarySchema,
    hostedComputerInventorySchema,
} from '@tavern/api';
import { eq } from 'drizzle-orm';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { recordAgentEffectiveState } from '../hosted-agents/record-agent-effective-state.ts';
import { recordAgentTurnSummary } from '../hosted-agents/record-agent-turn.ts';
import { recordHostedMcpInventory } from '../hosted-mcp/service.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentMcpToolGrantsTable, mcpConnectionsTable } from '../postgres/schema.ts';
import type { ComputerConnections } from './connections.ts';
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

const mcpInventorySchema = z
    .object({
        connectionId: z.string().regex(/^mcp_[A-Za-z0-9_-]{16}$/u),
        tools: z.array(z.string().trim().min(1).max(200)).max(1000),
        type: z.literal('mcp-inventory'),
    })
    .strict();

/** The only Server-to-Computer transport: one authenticated outbound socket per Computer. */
export function startComputerAttachmentSocket(
    server: Server,
    db: GrottoDatabase,
    connections: ComputerConnections
) {
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
                await ingestReport(db, connections, computerId, raw.toString());
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
                connections.register(computer.id, {
                    send: (frame) => socket.send(JSON.stringify(frame)),
                    serverId: computer.serverId,
                });
                if (hello.inventory) {
                    await recordComputerInventory(db, computer.id, hello.inventory);
                }
                const grants = await db
                    .select({
                        agentId: agentMcpToolGrantsTable.agentId,
                        connectionId: agentMcpToolGrantsTable.connectionId,
                        toolName: agentMcpToolGrantsTable.toolName,
                    })
                    .from(agentMcpToolGrantsTable)
                    .innerJoin(
                        mcpConnectionsTable,
                        eq(mcpConnectionsTable.id, agentMcpToolGrantsTable.connectionId)
                    )
                    .where(eq(mcpConnectionsTable.computerId, computer.id));
                socket.send(JSON.stringify({ grants, type: 'mcp-grants' }));
                socket.send(JSON.stringify({ computerId: computer.id, type: 'accepted' }));
            } catch {
                socket.close(4403, 'Computer credential was rejected.');
            }
        });
        socket.on('close', () => {
            if (computerId) {
                sockets.delete(computerId);
                connections.unregister(computerId);
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

async function ingestReport(
    db: GrottoDatabase,
    connections: ComputerConnections,
    computerId: string,
    raw: string
) {
    let frame: unknown;
    try {
        frame = JSON.parse(raw);
    } catch {
        return;
    }

    const turn = hostedAgentTurnSummarySchema.safeParse(frame);
    if (turn.success) {
        await recordAgentTurnSummary(db, computerId, turn.data);
        connections.finishRun(turn.data.agentId);
        return;
    }

    const mcpInventory = mcpInventorySchema.safeParse(frame);
    if (mcpInventory.success) {
        await recordHostedMcpInventory(db, computerId, mcpInventory.data);
        return;
    }

    const report = reportSchema.safeParse(frame);
    if (!report.success) {
        return;
    }
    if (report.data.inventory) {
        await recordComputerInventory(db, computerId, report.data.inventory);
    }
    if (report.data.agents.length > 0) {
        await recordAgentEffectiveState(db, computerId, report.data.agents);
    }
}
