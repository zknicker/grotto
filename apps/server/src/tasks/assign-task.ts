import { and, eq, isNull, sql } from 'drizzle-orm';
import { findHostedChatAccess, requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTasksTable, serverMembershipsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import {
    type HostedTaskMutationResult,
    HostedTaskNotFoundError,
    TaskConflictError,
} from './claim-task.ts';
import { insertHostedTaskEvent } from './task-events.ts';
import { findHostedMessageTask } from './task-shape.ts';

export class TaskAdminRequiredError extends Error {
    constructor() {
        super('Only a Server Owner or Admin may assign tasks to another member.');
        this.name = 'TaskAdminRequiredError';
    }
}

export class InvalidTaskAssigneeError extends Error {
    constructor() {
        super('The assignee must be an active Server member with access to the parent Chat.');
        this.name = 'InvalidTaskAssigneeError';
    }
}

export async function assignHostedTask(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: {
        assigneeUserId: string | null;
        expectedVersion: number;
        messageId: string;
        serverId: string;
    }
): Promise<HostedTaskMutationResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        if (!member) {
            throw new HostedTaskNotFoundError();
        }
        const currentBeforeLock = await findHostedMessageTask(tx, input.serverId, input.messageId);
        if (!currentBeforeLock) {
            throw new HostedTaskNotFoundError();
        }

        const membershipIds = [
            ...new Set([member.id, input.assigneeUserId].filter(Boolean)),
        ].sort();
        for (const userId of membershipIds) {
            await tx.execute(sql`
                select user_id from server_memberships
                where server_id = ${input.serverId}
                  and user_id = ${userId}
                  and revoked_at is null
                for update
            `);
        }

        const server = await requireServerMembership(tx, member, input.serverId);
        if (server.role !== 'owner' && server.role !== 'admin') {
            throw new TaskAdminRequiredError();
        }
        await requireChatAccess(tx, member, {
            chatId: currentBeforeLock.chatId,
            serverId: input.serverId,
        });
        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${currentBeforeLock.chatId}
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
            throw new TaskConflictError('That task changed; refresh it before assigning.');
        }

        if (input.assigneeUserId) {
            const [active] = await tx
                .select({ userId: serverMembershipsTable.userId })
                .from(serverMembershipsTable)
                .where(
                    and(
                        eq(serverMembershipsTable.serverId, input.serverId),
                        eq(serverMembershipsTable.userId, input.assigneeUserId),
                        isNull(serverMembershipsTable.revokedAt)
                    )
                )
                .limit(1);
            const access = active
                ? await findHostedChatAccess(tx, active.userId, {
                      chatId: current.chatId,
                      serverId: input.serverId,
                  })
                : null;
            if (!(active && access)) {
                throw new InvalidTaskAssigneeError();
            }
        }

        await tx
            .update(messageTasksTable)
            .set({
                assigneeUserId: input.assigneeUserId,
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
