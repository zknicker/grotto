import { and, eq, sql } from 'drizzle-orm';
import { requireChatWriteAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTasksTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { TaskConflictError, type TaskMutationResult, TaskNotFoundError } from './claim-task.ts';
import { insertTaskEvent } from './task-events.ts';
import { findMessageTask } from './task-shape.ts';

export async function unclaimTask(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { expectedVersion: number; messageId: string; serverId: string }
): Promise<TaskMutationResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        if (!member) {
            throw new TaskNotFoundError();
        }
        const beforeLock = await findMessageTask(tx, input.serverId, input.messageId);
        if (!beforeLock) {
            throw new TaskNotFoundError();
        }
        await tx.execute(sql`
            select user_id from server_memberships
            where server_id = ${input.serverId}
              and user_id = ${member.id}
              and revoked_at is null
            for update
        `);
        await requireChatWriteAccess(tx, member, {
            chatId: beforeLock.chatId,
            serverId: input.serverId,
        });
        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${beforeLock.chatId}
            for update
        `);
        await tx.execute(sql`
            select message_id from message_tasks
            where server_id = ${input.serverId} and message_id = ${input.messageId}
            for update
        `);

        const current = await findMessageTask(tx, input.serverId, input.messageId);
        if (!current) {
            throw new TaskNotFoundError();
        }
        if (current.assigneeUserId !== member.id) {
            throw new TaskConflictError('Only the current assignee may unclaim this task.');
        }
        if (current.status === 'done') {
            throw new TaskConflictError('Done tasks cannot be unclaimed.');
        }
        if (current.version !== input.expectedVersion) {
            throw new TaskConflictError('That task changed; refresh it before unclaiming.');
        }

        await tx
            .update(messageTasksTable)
            .set({
                assigneeUserId: null,
                claimedAt: null,
                updatedAt: sql`now()`,
                version: sql`${messageTasksTable.version} + 1`,
            })
            .where(
                and(
                    eq(messageTasksTable.serverId, input.serverId),
                    eq(messageTasksTable.messageId, input.messageId)
                )
            );
        const event = await insertTaskEvent(tx, {
            chatId: current.chatId,
            messageId: current.messageId,
            serverId: input.serverId,
            type: 'task.updated',
        });
        const task = await findMessageTask(tx, input.serverId, input.messageId);
        if (!task) {
            throw new TaskNotFoundError();
        }
        return { event, task };
    });
}
