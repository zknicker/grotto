import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentDeliveryTable, agentInboxTable } from '../postgres/schema.ts';
import { threadChatIdForAnchor } from '../threads/thread-id.ts';

/** The task columns liveness reads. */
export interface TaskLivenessRow {
    assigneeAgentId: string | null;
    messageId: string;
}

/**
 * A task is live while its assignee Agent's one in-flight run holds an inbox
 * row anchored on the task's own message or on its Thread — attached to the
 * run by a pull, or offered to it as a notice in the run's own Chat. Liveness
 * is volatile execution state derived at read time, never a stored task
 * column; the run's start and its settlement both emit `task.updated`, so the
 * App learns about it the same way it learns about every other task change.
 */
export async function loadLiveTaskMessageIds(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    rows: TaskLivenessRow[]
): Promise<Set<string>> {
    const assigned = rows.filter((row) => row.assigneeAgentId !== null);
    if (assigned.length === 0) {
        return new Set();
    }
    const anchorByKey = new Map<string, string>();
    for (const row of assigned) {
        anchorByKey.set(`${row.assigneeAgentId} ${row.messageId}`, row.messageId);
        anchorByKey.set(
            `${row.assigneeAgentId} ${threadChatIdForAnchor(row.messageId)}`,
            row.messageId
        );
    }
    const agentIds = [...new Set(assigned.map((row) => row.assigneeAgentId as string))];
    const served = await db
        .select({
            agentId: agentInboxTable.agentId,
            chatId: agentInboxTable.chatId,
            dedupeKey: agentInboxTable.dedupeKey,
        })
        .from(agentInboxTable)
        .innerJoin(
            agentDeliveryTable,
            and(
                eq(agentDeliveryTable.agentId, agentInboxTable.agentId),
                or(
                    eq(agentDeliveryTable.activeRunId, agentInboxTable.runId),
                    and(
                        eq(agentDeliveryTable.activeRunId, agentInboxTable.noticeRunId),
                        eq(agentDeliveryTable.activeRunChatId, agentInboxTable.chatId)
                    )
                )
            )
        )
        .where(
            and(
                eq(agentInboxTable.serverId, serverId),
                inArray(agentInboxTable.agentId, agentIds),
                ne(agentInboxTable.state, 'seen')
            )
        );
    const live = new Set<string>();
    for (const row of served) {
        const byMessage = anchorByKey.get(`${row.agentId} ${row.dedupeKey}`);
        if (byMessage) {
            live.add(byMessage);
        }
        const byThread = anchorByKey.get(`${row.agentId} ${row.chatId}`);
        if (byThread) {
            live.add(byThread);
        }
    }
    return live;
}
