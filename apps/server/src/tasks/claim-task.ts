import type { HostedDurableEvent, HostedMessageTask } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTasksTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { insertHostedTaskEvent } from './task-events.ts';
import { taskHasOtherOwnerForUser } from './task-ownership.ts';
import { findHostedMessageTask } from './task-shape.ts';

export class TaskConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TaskConflictError';
    }
}

export class HostedTaskNotFoundError extends Error {
    constructor() {
        super('No task exists in this Server with that message id.');
        this.name = 'HostedTaskNotFoundError';
    }
}

export interface HostedTaskMutationResult {
    event: HostedDurableEvent | null;
    task: HostedMessageTask;
}

export async function claimHostedTask(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { expectedVersion: number; messageId: string; serverId: string }
): Promise<HostedTaskMutationResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        if (!member) {
            throw new HostedTaskNotFoundError();
        }
        const initial = await findTaskCoordinates(tx, input);

        await tx.execute(sql`
            select user_id from server_memberships
            where server_id = ${input.serverId}
              and user_id = ${member.id}
              and revoked_at is null
            for update
        `);
        await requireChatAccess(tx, member, {
            chatId: initial.chatId,
            serverId: input.serverId,
        });
        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${initial.chatId}
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
        if (current.assigneeUserId === member.id && current.claimedAt !== null) {
            return { event: null, task: current };
        }
        if (taskHasOtherOwnerForUser(current, member.id)) {
            throw new TaskConflictError('That task is already owned by another assignee.');
        }
        if (current.status === 'done') {
            throw new TaskConflictError('Done tasks cannot be claimed.');
        }
        if (current.version !== input.expectedVersion) {
            throw new TaskConflictError('That task changed; refresh it before claiming.');
        }

        await tx
            .update(messageTasksTable)
            .set({
                assigneeAgentId: null,
                assigneeUserId: member.id,
                claimedAt: sql`now()`,
                status: current.status === 'todo' ? 'in_progress' : current.status,
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

async function findTaskCoordinates(
    db: Pick<GrottoDatabase, 'select'>,
    input: { messageId: string; serverId: string }
) {
    const [task] = await db
        .select({ chatId: messageTasksTable.chatId })
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, input.serverId),
                eq(messageTasksTable.messageId, input.messageId)
            )
        )
        .limit(1);
    if (!task) {
        throw new HostedTaskNotFoundError();
    }
    return task;
}
