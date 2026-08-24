import type { TaskListItem } from '@grotto/api';
import { and, desc, eq, sql } from 'drizzle-orm';
import { visibleChats } from '../chats/chat-visibility.ts';
import { toChatMessage } from '../chats/message-shape.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable, chatsTable, messageTasksTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { listThreadSummaries } from '../threads/list-thread-summaries.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { listTaskLabelMap, toMessageTaskWithLabels } from './task-shape.ts';

export async function listTasks(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId?: string; serverId: string }
): Promise<TaskListItem[]> {
    await requireServerMembership(db, member, input.serverId);
    if (!member) {
        return [];
    }
    const predicates = [eq(messageTasksTable.serverId, input.serverId), visibleChats(member.id)];
    if (input.chatId) {
        predicates.push(eq(messageTasksTable.chatId, input.chatId));
    }
    const rows = await db
        .select({
            chatKind: chatsTable.kind,
            chatName: chatsTable.name,
            chatPeerUserId: sql<string | null>`case
                when ${chatsTable.dmMemberOneUserId} = ${member.id}
                then ${chatsTable.dmMemberTwoUserId}
                else ${chatsTable.dmMemberOneUserId}
            end`,
            message: chatMessagesTable,
            task: messageTasksTable,
        })
        .from(messageTasksTable)
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, messageTasksTable.serverId),
                eq(chatsTable.id, messageTasksTable.chatId)
            )
        )
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, messageTasksTable.serverId),
                eq(chatMessagesTable.id, messageTasksTable.messageId)
            )
        )
        .where(and(...predicates))
        .orderBy(desc(messageTasksTable.updatedAt));

    const labels = await listTaskLabelMap(
        db,
        input.serverId,
        rows.map((row) => row.task.messageId)
    );
    const summaries = await listThreadSummaries(db, member, {
        anchorMessageIds: rows.map((row) => row.task.messageId),
        serverId: input.serverId,
    });
    const summaryByMessageId = new Map(
        summaries.map((summary) => [summary.anchorMessageId, summary])
    );
    const tasks: TaskListItem[] = [];
    for (const row of rows) {
        if (row.chatKind !== 'channel' && row.chatKind !== 'dm') {
            continue;
        }
        const task = toMessageTaskWithLabels(row.task, labels.get(row.task.messageId));
        const threadSummary = summaryByMessageId.get(row.task.messageId);
        if (!threadSummary) {
            throw new Error('A task must have its deterministic Thread.');
        }
        tasks.push({
            chatKind: row.chatKind,
            chatName: row.chatName,
            chatPeerUserId: row.chatPeerUserId,
            message: { ...toChatMessage(row.message), task },
            task,
            threadSummary,
        });
    }
    return tasks;
}
