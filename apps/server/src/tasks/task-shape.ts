import type { MessageTask, TaskLabel } from '@tavern/api';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTaskLabelsTable, messageTasksTable, taskLabelsTable } from '../postgres/schema.ts';

export type MessageTaskRow = typeof messageTasksTable.$inferSelect;

export async function findMessageTask(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageId: string
): Promise<MessageTask | null> {
    const [row] = await db
        .select()
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, serverId),
                eq(messageTasksTable.messageId, messageId)
            )
        )
        .limit(1);

    return row ? await toMessageTask(db, row) : null;
}

export async function listMessageTaskMap(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, MessageTask>> {
    if (messageIds.length === 0) {
        return new Map();
    }
    const rows = await db
        .select()
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, serverId),
                inArray(messageTasksTable.messageId, messageIds)
            )
        );
    const labels = await listTaskLabelMap(db, serverId, messageIds);
    const tasks = rows.map((row) => toMessageTaskWithLabels(row, labels.get(row.messageId)));

    return new Map(tasks.map((task) => [task.messageId, task]));
}

export async function toMessageTask(
    db: Pick<GrottoDatabase, 'select'>,
    row: MessageTaskRow
): Promise<MessageTask> {
    const labels = await listTaskLabels(db, row.serverId, row.messageId);
    return toMessageTaskWithLabels(row, labels);
}

export function toMessageTaskWithLabels(
    row: MessageTaskRow,
    labels: TaskLabel[] = []
): MessageTask {
    return {
        assigneeAgentId: row.assigneeAgentId,
        assigneeUserId: row.assigneeUserId,
        chatId: row.chatId,
        claimedAt: row.claimedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        createdByAgentId: row.createdByAgentId,
        createdByUserId: row.createdByUserId,
        labels,
        messageId: row.messageId,
        number: row.number,
        origin: row.origin,
        priority: row.priority,
        status: row.status,
        threadChatId: `cht_thr_${stripMessagePrefix(row.messageId)}`,
        updatedAt: row.updatedAt.toISOString(),
        version: row.version,
    };
}

export async function listTaskLabelMap(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, TaskLabel[]>> {
    if (messageIds.length === 0) {
        return new Map();
    }
    const rows = await db
        .select({
            color: taskLabelsTable.color,
            id: taskLabelsTable.id,
            messageId: messageTaskLabelsTable.messageId,
            name: taskLabelsTable.name,
        })
        .from(messageTaskLabelsTable)
        .innerJoin(
            taskLabelsTable,
            and(
                eq(taskLabelsTable.serverId, messageTaskLabelsTable.serverId),
                eq(taskLabelsTable.id, messageTaskLabelsTable.labelId)
            )
        )
        .where(
            and(
                eq(messageTaskLabelsTable.serverId, serverId),
                inArray(messageTaskLabelsTable.messageId, messageIds)
            )
        )
        .orderBy(asc(messageTaskLabelsTable.messageId), asc(taskLabelsTable.name));
    const labels = new Map<string, TaskLabel[]>();
    for (const row of rows) {
        const current = labels.get(row.messageId) ?? [];
        current.push({ color: row.color, id: row.id, name: row.name });
        labels.set(row.messageId, current);
    }
    return labels;
}

async function listTaskLabels(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageId: string
): Promise<TaskLabel[]> {
    return (await listTaskLabelMap(db, serverId, [messageId])).get(messageId) ?? [];
}

function stripMessagePrefix(messageId: string) {
    return messageId.startsWith('msg_') ? messageId.slice(4) : messageId;
}
