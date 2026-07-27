import type { HostedTaskListItem } from '@tavern/api';
import { and, desc, eq } from 'drizzle-orm';
import { visibleHostedChats } from '../chats/chat-visibility.ts';
import { toHostedChatMessage } from '../chats/message-shape.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable, chatsTable, messageTasksTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { listHostedTaskLabelMap, toHostedMessageTaskWithLabels } from './task-shape.ts';

export async function listHostedTasks(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId?: string; serverId: string }
): Promise<HostedTaskListItem[]> {
    await requireServerMembership(db, member, input.serverId);
    if (!member) {
        return [];
    }
    const predicates = [
        eq(messageTasksTable.serverId, input.serverId),
        visibleHostedChats(member.id),
    ];
    if (input.chatId) {
        predicates.push(eq(messageTasksTable.chatId, input.chatId));
    }
    const rows = await db
        .select({
            chatKind: chatsTable.kind,
            chatName: chatsTable.name,
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

    const labels = await listHostedTaskLabelMap(
        db,
        input.serverId,
        rows.map((row) => row.task.messageId)
    );
    const tasks: HostedTaskListItem[] = [];
    for (const row of rows) {
        if (row.chatKind !== 'channel' && row.chatKind !== 'dm') {
            continue;
        }
        const task = toHostedMessageTaskWithLabels(row.task, labels.get(row.task.messageId));
        tasks.push({
            chatKind: row.chatKind,
            chatName: row.chatName,
            message: { ...toHostedChatMessage(row.message), task },
            task,
        });
    }
    return tasks;
}
