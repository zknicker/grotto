import type { HostedMessageTask, HostedTaskLabel } from '@tavern/api';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTaskLabelsTable, messageTasksTable, taskLabelsTable } from '../postgres/schema.ts';

export type MessageTaskRow = typeof messageTasksTable.$inferSelect;

export async function findHostedMessageTask(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageId: string
): Promise<HostedMessageTask | null> {
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

    return row ? await toHostedMessageTask(db, row) : null;
}

export async function listHostedMessageTaskMap(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, HostedMessageTask>> {
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
    const labels = await listHostedTaskLabelMap(db, serverId, messageIds);
    const tasks = rows.map((row) => toHostedMessageTaskWithLabels(row, labels.get(row.messageId)));

    return new Map(tasks.map((task) => [task.messageId, task]));
}

export async function toHostedMessageTask(
    db: Pick<GrottoDatabase, 'select'>,
    row: MessageTaskRow
): Promise<HostedMessageTask> {
    const labels = await listHostedTaskLabels(db, row.serverId, row.messageId);
    return toHostedMessageTaskWithLabels(row, labels);
}

export function toHostedMessageTaskWithLabels(
    row: MessageTaskRow,
    labels: HostedTaskLabel[] = []
): HostedMessageTask {
    return {
        assigneeUserId: row.assigneeUserId,
        chatId: row.chatId,
        claimedAt: row.claimedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
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

export async function listHostedTaskLabelMap(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, HostedTaskLabel[]>> {
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
    const labels = new Map<string, HostedTaskLabel[]>();
    for (const row of rows) {
        const current = labels.get(row.messageId) ?? [];
        current.push({ color: row.color, id: row.id, name: row.name });
        labels.set(row.messageId, current);
    }
    return labels;
}

async function listHostedTaskLabels(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageId: string
): Promise<HostedTaskLabel[]> {
    return (await listHostedTaskLabelMap(db, serverId, [messageId])).get(messageId) ?? [];
}

function stripMessagePrefix(messageId: string) {
    return messageId.startsWith('msg_') ? messageId.slice(4) : messageId;
}
