import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
    computerBootstrapHelloSchema,
    computerProtocolVersion,
    computerUpdateProgressFrameSchema,
    hostedAgentDeliveryAckSchema,
    hostedAgentEffectiveStateSchema,
    hostedAgentTurnSummarySchema,
    hostedComputerInventorySchema,
} from '@tavern/api';
import { eq } from 'drizzle-orm';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { recordAgentEffectiveState } from '../hosted-agents/record-agent-effective-state.ts';
import { recordHostedMcpInventory } from '../hosted-mcp/service.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentMcpToolGrantsTable, mcpConnectionsTable } from '../postgres/schema.ts';
import type { ComputerConnections } from './connections.ts';
import {
    hashComputerSecret,
    markComputerOffline,
    recordComputerInventory,
    reportComputerHandshake,
    reportComputerUpdateProgress,
} from './service.ts';

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
    connections: ComputerConnections,
    delivery: AgentDelivery
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
        let ordinary = false;
        socket.on('message', async (raw) => {
            if (computerId) {
                await ingestReport(db, connections, delivery, computerId, ordinary, raw.toString());
                return;
            }
            try {
                const hello = computerBootstrapHelloSchema.parse(JSON.parse(raw.toString()));
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
                ordinary = hello.protocolVersion === computerProtocolVersion;
                sockets.set(computer.id, socket);
                connections.register(computer.id, {
                    ordinary,
                    send: (frame) => socket.send(JSON.stringify(frame)),
                    serverId: computer.serverId,
                    updatePhase: hello.update.phase,
                });
                socket.send(
                    JSON.stringify({
                        mode: ordinary ? 'ordinary' : 'update-required',
                        type: 'bootstrap-accepted',
                    })
                );
                if (!ordinary) {
                    return;
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
                // Idempotent reconnect: resend unacknowledged deliveries and drain
                // any pending inbox for this Computer's Agents.
                void delivery.onComputerReconnect(computer.id).catch(() => undefined);
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
    delivery: AgentDelivery,
    computerId: string,
    ordinary: boolean,
    raw: string
) {
    let frame: unknown;
    try {
        frame = JSON.parse(raw);
    } catch {
        return;
    }

    const update = computerUpdateProgressFrameSchema.safeParse(frame);
    if (update.success) {
        connections.setUpdatePhase(computerId, update.data.update.phase);
        await reportComputerUpdateProgress(db, computerId, update.data.update);
        return;
    }
    if (!ordinary) {
        return;
    }

    const ack = hostedAgentDeliveryAckSchema.safeParse(frame);
    if (ack.success) {
        await delivery.onAck(ack.data);
        return;
    }

    const turn = hostedAgentTurnSummarySchema.safeParse(frame);
    if (turn.success) {
        // Delivery records the durable summary and drains the next turn; a
        // duplicate frame for an already-settled run is a no-op.
        await delivery.onTurnSettled(computerId, turn.data);
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
