import type { ServerDurableEvent } from '@haus/api';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { HausDatabase } from '../postgres/connection.ts';
import { agentInboxTable, messageTasksTable } from '../postgres/schema.ts';
import { anchorMessageIdForThreadChatId } from '../threads/thread-id.ts';
import { classifyRunReplyInChat } from './run-reply.ts';
import { insertTaskEvent } from './task-events.ts';
import { loadTaskTierEvidence, resolveTaskTier, taskTierEvidenceFor } from './task-tier.ts';

type TaskWriter = Pick<HausDatabase, 'insert' | 'select' | 'update'>;

interface RunScope {
    agentId: string;
    runId: string;
    serverId: string;
}

interface SettleScope extends RunScope {
    /**
     * Whether the turn ran to completion. A failed, interrupted, stopped, or
     * reset run proves nothing about the work, so its replies are not read as
     * an answer: those claims are stamped tracked instead of closed.
     */
    completed: boolean;
}

/**
 * Resolves the Agent's outstanding background claims when its run settles.
 *
 * A background claim is a lock the Agent took to do work inside one turn. If
 * the turn completed and finished with an answer in the task's own Chat — a
 * reply written after the run's last tool-shaped operation, not the "I'm on
 * it" acknowledgment that precedes deep work — the work is finished and Server
 * says so: the task becomes `done` without ever asking a human to review it.
 * If the run settled and the task is still open — no answer, an answer that
 * was only an acknowledgment, or a turn that failed, was interrupted, or was
 * killed before it could finish — the work outlived the turn, which is exactly
 * the thing a person should be able to see: the task is stamped tracked and
 * joins the ordinary Board and List from then on.
 *
 * Both outcomes emit `task.updated`, as does the liveness edge every settling
 * run crosses, so no client polls for either.
 */
export async function settleAgentBackgroundClaims(
    db: TaskWriter,
    scope: SettleScope
): Promise<ServerDurableEvent[]> {
    const candidates = await db
        .select()
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, scope.serverId),
                eq(messageTasksTable.assigneeAgentId, scope.agentId),
                eq(messageTasksTable.origin, 'claimed'),
                eq(messageTasksTable.status, 'in_progress'),
                isNull(messageTasksTable.trackedAt)
            )
        );
    const evidence = await loadTaskTierEvidence(db, scope.serverId, candidates);
    const changed = new Map<string, { chatId: string; messageId: string }>();
    for (const task of candidates) {
        if (resolveTaskTier(task, taskTierEvidenceFor(evidence, task.messageId)) !== 'background') {
            continue;
        }
        const answered =
            scope.completed &&
            (await classifyRunReplyInChat(db, scope, task.chatId)) === 'finishing';
        await db
            .update(messageTasksTable)
            .set({
                ...(answered ? { status: 'done' as const } : { trackedAt: sql`now()` }),
                updatedAt: sql`now()`,
                version: sql`${messageTasksTable.version} + 1`,
            })
            .where(
                and(
                    eq(messageTasksTable.serverId, scope.serverId),
                    eq(messageTasksTable.messageId, task.messageId)
                )
            );
        changed.set(task.messageId, { chatId: task.chatId, messageId: task.messageId });
    }
    for (const held of await tasksHeldByRun(db, scope)) {
        changed.set(held.messageId, held);
    }
    const events: ServerDurableEvent[] = [];
    for (const task of changed.values()) {
        events.push(
            await insertTaskEvent(db, {
                chatId: task.chatId,
                messageId: task.messageId,
                serverId: scope.serverId,
                type: 'task.updated',
            })
        );
    }
    return events;
}

/** `task.updated` for every task this run holds — the liveness edge, either way. */
export async function runLivenessTaskEvents(
    db: TaskWriter,
    scope: RunScope
): Promise<ServerDurableEvent[]> {
    const events: ServerDurableEvent[] = [];
    for (const task of await tasksHeldByRun(db, scope)) {
        events.push(
            await insertTaskEvent(db, {
                chatId: task.chatId,
                messageId: task.messageId,
                serverId: scope.serverId,
                type: 'task.updated',
            })
        );
    }
    return events;
}

/** The tasks this run's inbox rows anchor on, by message or by Thread. */
async function tasksHeldByRun(db: TaskWriter, scope: RunScope) {
    const rows = await db
        .select({ chatId: agentInboxTable.chatId, dedupeKey: agentInboxTable.dedupeKey })
        .from(agentInboxTable)
        .where(
            and(
                eq(agentInboxTable.serverId, scope.serverId),
                eq(agentInboxTable.agentId, scope.agentId),
                ne(agentInboxTable.state, 'seen'),
                or(
                    eq(agentInboxTable.runId, scope.runId),
                    eq(agentInboxTable.noticeRunId, scope.runId)
                )
            )
        );
    if (rows.length === 0) {
        return [];
    }
    const anchors = new Set<string>();
    for (const row of rows) {
        anchors.add(row.dedupeKey);
        const threadAnchor = anchorMessageIdForThreadChatId(row.chatId);
        if (threadAnchor) {
            anchors.add(threadAnchor);
        }
    }
    return await db
        .select({
            chatId: messageTasksTable.chatId,
            messageId: messageTasksTable.messageId,
        })
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, scope.serverId),
                inArray(messageTasksTable.messageId, [...anchors])
            )
        );
}
