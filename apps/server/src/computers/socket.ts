import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
    agentActivityFrameSchema,
    agentDeliveryAckSchema,
    agentEffectiveStateSchema,
    agentExecutionJournalResultSchema,
    agentNoticeAckSchema,
    agentSkillFileResultSchema,
    agentSkillImportResultSchema,
    agentTurnSummarySchema,
    agentWorkspaceResultSchema,
    browserResultSchema,
    computerBootstrapHelloSchema,
    computerInventorySchema,
    computerProtocolVersion,
    computerUpdateProgressFrameSchema,
    coveApplyResultSchema,
    reminderScriptResultSchema,
    usageReportSchema,
} from '@grotto/api';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { publishCommittedAgentActivity } from '../agent-delivery/activity-events.ts';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { emitServerUpdated } from '../grotto-api/server-events.ts';
import { recordCoveApplyResult, sendPendingCoveApplication } from '../onboarding/create-cove.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { recordComputerAgentActivityWithStatus } from '../server-agents/agent-activity.ts';
import { recordAgentEffectiveState } from '../server-agents/record-agent-effective-state.ts';
import { recordComputerUsage } from '../server-operations/computer-usage.ts';
import type { ComputerConnections } from './connections.ts';
import {
    hashComputerSecret,
    markComputerOffline,
    recordComputerInventory,
    recordInvalidComputerInventory,
    reportComputerHandshake,
    reportComputerUpdateProgress,
} from './service.ts';

/** Ongoing report of last-reported inventory and per-Agent effective state. */
const reportSchema = z
    .object({
        agents: z.array(agentEffectiveStateSchema).max(500).default([]),
        inventory: computerInventorySchema.optional(),
        type: z.literal('report'),
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
        let attachedServerId: string | null = null;
        let ordinary = false;
        let messageQueue = Promise.resolve();
        socket.on('message', (raw) => {
            messageQueue = messageQueue
                .then(async () => {
                    if (computerId && attachedServerId) {
                        await ingestReport(
                            db,
                            connections,
                            delivery,
                            computerId,
                            attachedServerId,
                            ordinary,
                            raw.toString()
                        );
                        return;
                    }
                    try {
                        const hello = computerBootstrapHelloSchema.parse(
                            JSON.parse(raw.toString())
                        );
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
                        attachedServerId = computer.serverId;
                        ordinary = hello.protocolVersion === computerProtocolVersion;
                        sockets.set(computer.id, socket);
                        connections.register(computer.id, {
                            disconnect: (reason) => socket.close(4000, reason),
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
                        emitServerUpdated({ scope: 'computer', serverId: computer.serverId });
                        if (!ordinary) {
                            return;
                        }
                        void sendPendingCoveApplication(db, connections, computer.id).catch(
                            () => undefined
                        );
                        // Idempotent reconnect: resend unacknowledged deliveries and drain
                        // any pending inbox for this Computer's Agents.
                        void delivery.onComputerReconnect(computer.id).catch(() => undefined);
                    } catch {
                        socket.close(4403, 'Computer credential was rejected.');
                    }
                })
                .catch(() => {
                    socket.close(1011, 'Computer report failed.');
                });
        });
        socket.on('close', () => {
            if (computerId) {
                sockets.delete(computerId);
                connections.unregister(computerId);
                if (attachedServerId) {
                    const serverId = attachedServerId;
                    void markComputerOffline(db, computerId).then(() => {
                        emitServerUpdated({ scope: 'computer', serverId });
                    });
                } else {
                    void markComputerOffline(db, computerId);
                }
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
    serverId: string,
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
        const recorded = await reportComputerUpdateProgress(db, computerId, update.data.update);
        if (recorded) {
            connections.setUpdatePhase(computerId, update.data.update.phase);
            emitServerUpdated({ scope: 'computer', serverId });
        }
        return;
    }
    if (!ordinary) {
        return;
    }

    const activity = agentActivityFrameSchema.safeParse(frame);
    if (activity.success) {
        const committed = await recordComputerAgentActivityWithStatus(db, {
            computerId,
            frame: activity.data,
            serverId,
        });
        if (committed?.inserted) {
            publishCommittedAgentActivity(committed.event);
        }
        return;
    }

    const ack = agentDeliveryAckSchema.safeParse(frame);
    if (ack.success) {
        await delivery.onAck(ack.data);
        return;
    }
    const noticeAck = agentNoticeAckSchema.safeParse(frame);
    if (noticeAck.success) {
        await delivery.onNoticeAck(noticeAck.data);
        return;
    }

    const coveApply = coveApplyResultSchema.safeParse(frame);
    if (coveApply.success) {
        const changedServerId = await recordCoveApplyResult(db, computerId, coveApply.data);
        if (changedServerId) {
            emitServerUpdated({
                agentId: coveApply.data.agentId,
                scope: 'agent',
                serverId: changedServerId,
            });
            if (coveApply.data.status === 'applied') {
                await delivery.dispatchAgent(coveApply.data.agentId, changedServerId);
            }
        }
        return;
    }

    const turn = agentTurnSummarySchema.safeParse(frame);
    if (turn.success) {
        // Delivery records the durable summary and drains the next turn; a
        // duplicate frame for an already-settled run is a no-op.
        await delivery.onTurnSettled(computerId, turn.data);
        return;
    }

    const reminderScript = reminderScriptResultSchema.safeParse(frame);
    if (reminderScript.success) {
        await delivery.onReminderScriptResult(computerId, reminderScript.data);
        return;
    }

    const skillImport = agentSkillImportResultSchema.safeParse(frame);
    if (skillImport.success) {
        connections.acceptSkillImport(computerId, skillImport.data);
        return;
    }

    const skillFile = agentSkillFileResultSchema.safeParse(frame);
    if (skillFile.success) {
        connections.acceptSkillFileResult(computerId, skillFile.data);
        return;
    }

    const workspace = agentWorkspaceResultSchema.safeParse(frame);
    if (workspace.success) {
        connections.acceptWorkspaceResult(computerId, workspace.data);
        return;
    }

    const executionJournal = agentExecutionJournalResultSchema.safeParse(frame);
    if (executionJournal.success) {
        connections.acceptExecutionJournalResult(computerId, executionJournal.data);
        return;
    }

    const browser = browserResultSchema.safeParse(frame);
    if (browser.success) {
        connections.acceptBrowserResult(computerId, browser.data);
        return;
    }

    const usage = usageReportSchema.safeParse(frame);
    if (usage.success) {
        await recordComputerUsage(db, {
            computerId,
            serverId,
            usage: usage.data.usage,
        });
        emitServerUpdated({ scope: 'computer', serverId });
        return;
    }

    const report = reportSchema.safeParse(frame);
    if (!report.success) {
        if (
            typeof frame === 'object' &&
            frame !== null &&
            'type' in frame &&
            frame.type === 'report' &&
            'inventory' in frame
        ) {
            await recordInvalidComputerInventory(db, computerId, serverId);
            emitServerUpdated({ scope: 'computer', serverId });
        }
        return;
    }
    if (report.data.inventory) {
        await recordComputerInventory(db, computerId, report.data.inventory);
    }
    if (report.data.agents.length > 0) {
        await recordAgentEffectiveState(db, computerId, report.data.agents);
    }
    emitServerUpdated({ scope: 'computer', serverId });
}
