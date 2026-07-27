import type { HostedDurableEvent } from '@tavern/api';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTasksTable } from '../postgres/schema.ts';
import { insertHostedTaskEvent } from './task-events.ts';

type TaskAssignmentWriter = Pick<GrottoDatabase, 'insert' | 'select' | 'update'>;

/**
 * Releases task ownership held by one departing human. The caller owns the
 * Server lock, so task writers cannot race this selection or its ordered
 * updates.
 */
export async function clearHostedTaskAssignments(
    db: TaskAssignmentWriter,
    serverId: string,
    userId: string
): Promise<HostedDurableEvent[]> {
    const assigned = await db
        .select({
            chatId: messageTasksTable.chatId,
            messageId: messageTasksTable.messageId,
        })
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, serverId),
                eq(messageTasksTable.assigneeUserId, userId)
            )
        )
        .orderBy(asc(messageTasksTable.messageId));
    const events: HostedDurableEvent[] = [];

    for (const task of assigned) {
        await db
            .update(messageTasksTable)
            .set({
                assigneeUserId: null,
                claimedAt: null,
                updatedAt: sql`now()`,
                version: sql`${messageTasksTable.version} + 1`,
            })
            .where(
                and(
                    eq(messageTasksTable.serverId, serverId),
                    eq(messageTasksTable.messageId, task.messageId),
                    eq(messageTasksTable.assigneeUserId, userId)
                )
            );
        events.push(
            await insertHostedTaskEvent(db, {
                chatId: task.chatId,
                messageId: task.messageId,
                serverId,
                type: 'task.updated',
            })
        );
    }

    return events;
}
