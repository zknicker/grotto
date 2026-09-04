import {
    type CloudAgentObservation,
    type CloudAgentWork,
    isTerminalCloudAgentStatus,
    type ServerDurableEvent,
} from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { cloudAgentRunsTable, cloudAgentWorkTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import {
    type CloudAgentEventChat,
    insertCloudAgentWorkEvent,
    readCloudAgentEventAnchor,
} from './cloud-agent-events.ts';
import { findCloudAgentWork } from './cloud-agent-shape.ts';

export interface AppliedCloudAgentObservation {
    event: ServerDurableEvent;
    /** The delegating Agent to wake, set only when a Run just settled. */
    wake: { agentId: string; serverId: string } | null;
    work: CloudAgentWork;
}

/**
 * Applies one bounded Computer observation to its Run and work. A duplicate,
 * out-of-order, or post-terminal observation is a no-op: the first terminal
 * result a Run reports is the one that stands. A Run that settles here also
 * settles its work and creates exactly one durable inbox attention for the
 * delegating Agent, in the same transaction.
 */
export async function applyCloudAgentObservation(
    db: GrottoDatabase,
    input: { computerId: string; observation: CloudAgentObservation; serverId: string },
    agentDelivery: AgentDelivery
): Promise<AppliedCloudAgentObservation | null> {
    const { observation } = input;
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const [row] = await tx
            .select({
                agentId: cloudAgentWorkTable.agentId,
                chatId: cloudAgentWorkTable.chatId,
                computerId: cloudAgentWorkTable.computerId,
                messageId: cloudAgentWorkTable.messageId,
                observedAt: cloudAgentRunsTable.observedAt,
                runStatus: cloudAgentRunsTable.status,
                startedAt: cloudAgentWorkTable.startedAt,
                terminalAt: cloudAgentRunsTable.terminalAt,
            })
            .from(cloudAgentRunsTable)
            .innerJoin(
                cloudAgentWorkTable,
                and(
                    eq(cloudAgentWorkTable.serverId, cloudAgentRunsTable.serverId),
                    eq(cloudAgentWorkTable.id, cloudAgentRunsTable.workId)
                )
            )
            .where(
                and(
                    eq(cloudAgentRunsTable.serverId, input.serverId),
                    eq(cloudAgentRunsTable.id, observation.runId),
                    eq(cloudAgentRunsTable.workId, observation.workId)
                )
            )
            .limit(1);
        if (!row || row.computerId !== input.computerId) {
            return null;
        }
        const observedAt = new Date(observation.observedAt);
        if (row.terminalAt || (row.observedAt && row.observedAt >= observedAt)) {
            return null;
        }

        const settling = isTerminalCloudAgentStatus(observation.status);
        const startedAt = observation.status === 'queued' ? null : observedAt;
        await tx
            .update(cloudAgentRunsTable)
            .set({
                ...(observation.branches ? { branches: observation.branches } : {}),
                ...(observation.errorCode ? { errorCode: observation.errorCode } : {}),
                observedAt,
                ...(observation.providerRunId ? { providerRunId: observation.providerRunId } : {}),
                ...(observation.rawStatus ? { rawStatus: observation.rawStatus } : {}),
                ...(startedAt && !row.startedAt ? { startedAt } : {}),
                status: observation.status,
                ...(observation.summary ? { summary: observation.summary } : {}),
                terminalAt: settling ? observedAt : null,
                ...(observation.usage ? { usage: observation.usage } : {}),
            })
            .where(
                and(
                    eq(cloudAgentRunsTable.serverId, input.serverId),
                    eq(cloudAgentRunsTable.id, observation.runId)
                )
            );

        await tx
            .update(cloudAgentWorkTable)
            .set({
                ...(observation.activity
                    ? {
                          activityAt: new Date(observation.activity.at),
                          activitySummary: observation.activity.summary,
                      }
                    : {}),
                ...(observation.providerAgentId
                    ? { providerAgentId: observation.providerAgentId }
                    : {}),
                ...(observation.providerUrl ? { providerUrl: observation.providerUrl } : {}),
                ...(startedAt && !row.startedAt ? { startedAt } : {}),
                status: observation.status,
                terminalAt: settling ? observedAt : null,
                updatedAt: observedAt,
            })
            .where(
                and(
                    eq(cloudAgentWorkTable.serverId, input.serverId),
                    eq(cloudAgentWorkTable.id, observation.workId)
                )
            );

        if (settling) {
            await agentDelivery.enqueue(tx, {
                agentId: row.agentId,
                chatId: row.chatId,
                content: '',
                dedupeKey: observation.runId,
                serverId: input.serverId,
                source: 'cloud_agent_work',
            });
        }

        const work = await findCloudAgentWork(tx, input.serverId, observation.workId);
        if (!work) {
            throw new Error('The Cloud Agent work could not be projected after an observation.');
        }
        return {
            event: await emitWorkEvent(tx, {
                chatId: row.chatId,
                messageId: row.messageId,
                serverId: input.serverId,
                workId: observation.workId,
            }),
            wake: settling ? { agentId: row.agentId, serverId: input.serverId } : null,
            work,
        };
    });
}

export async function emitWorkEvent(
    db: GrottoDatabase,
    input: { chatId: string; messageId: string; serverId: string; workId: string }
): Promise<ServerDurableEvent> {
    const anchor: { chat: CloudAgentEventChat; sequence: number } = await readCloudAgentEventAnchor(
        db,
        input
    );
    return await insertCloudAgentWorkEvent(db, {
        chat: anchor.chat,
        chatId: input.chatId,
        cloudAgentWorkId: input.workId,
        messageId: input.messageId,
        sequence: anchor.sequence,
        serverId: input.serverId,
    });
}
