import { and, eq, sql } from 'drizzle-orm';
import { requireChatWriteAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTaskLabelsTable, messageTasksTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import {
    type HostedTaskMutationResult,
    HostedTaskNotFoundError,
    TaskConflictError,
} from './claim-task.ts';
import { insertHostedTaskEvent } from './task-events.ts';
import { requireHostedTaskLabelIds } from './task-labels.ts';
import { findHostedMessageTask } from './task-shape.ts';

export async function updateHostedTask(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: {
        expectedVersion: number;
        messageId: string;
        patch: {
            labelIds?: string[];
            priority?: 'none' | 'urgent' | 'high' | 'medium' | 'low';
            status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
        };
        serverId: string;
    }
): Promise<HostedTaskMutationResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        if (!member) {
            throw new HostedTaskNotFoundError();
        }
        const beforeLock = await findHostedMessageTask(tx, input.serverId, input.messageId);
        if (!beforeLock) {
            throw new HostedTaskNotFoundError();
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

        const current = await findHostedMessageTask(tx, input.serverId, input.messageId);
        if (!current) {
            throw new HostedTaskNotFoundError();
        }
        if (current.version !== input.expectedVersion) {
            throw new TaskConflictError('That task changed; refresh it before updating.');
        }
        if (input.patch.labelIds) {
            await requireHostedTaskLabelIds(tx, input.serverId, input.patch.labelIds);
            await tx
                .delete(messageTaskLabelsTable)
                .where(
                    and(
                        eq(messageTaskLabelsTable.serverId, input.serverId),
                        eq(messageTaskLabelsTable.messageId, input.messageId)
                    )
                );
            const labelIds = [...new Set(input.patch.labelIds)];
            if (labelIds.length > 0) {
                await tx.insert(messageTaskLabelsTable).values(
                    labelIds.map((labelId) => ({
                        labelId,
                        messageId: input.messageId,
                        serverId: input.serverId,
                    }))
                );
            }
        }
        await tx
            .update(messageTasksTable)
            .set({
                ...(input.patch.priority ? { priority: input.patch.priority } : {}),
                ...(input.patch.status ? { status: input.patch.status } : {}),
                updatedAt: sql`now()`,
                version: sql`${messageTasksTable.version} + 1`,
            })
            .where(
                and(
                    eq(messageTasksTable.serverId, input.serverId),
                    eq(messageTasksTable.messageId, input.messageId)
                )
            );
        const event = await insertHostedTaskEvent(tx, {
            chatId: current.chatId,
            messageId: current.messageId,
            serverId: input.serverId,
            type: 'task.updated',
        });
        const task = await findHostedMessageTask(tx, input.serverId, input.messageId);
        if (!task) {
            throw new HostedTaskNotFoundError();
        }
        return { event, task };
    });
}
