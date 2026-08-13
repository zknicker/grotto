import type { ServerDurableEvent } from '@tavern/api';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageTasksTable } from '../postgres/schema.ts';
import { insertTaskEvent } from './task-events.ts';

type TaskAssignmentWriter = Pick<GrottoDatabase, 'insert' | 'select' | 'update'>;

/**
 * Releases task ownership held by one departing actor. The caller owns the
 * Server lock, so task writers cannot race this selection or its ordered
 * updates.
 */
export async function clearTaskAssignments(
    db: TaskAssignmentWriter,
    serverId: string,
    actor: { id: string; kind: 'agent' | 'user' }
): Promise<ServerDurableEvent[]> {
    const assigneeColumn =
        actor.kind === 'agent'
            ? messageTasksTable.assigneeAgentId
            : messageTasksTable.assigneeUserId;
    const assigned = await db
        .select({
            chatId: messageTasksTable.chatId,
            messageId: messageTasksTable.messageId,
        })
        .from(messageTasksTable)
        .where(and(eq(messageTasksTable.serverId, serverId), eq(assigneeColumn, actor.id)))
        .orderBy(asc(messageTasksTable.messageId));
    const events: ServerDurableEvent[] = [];

    for (const task of assigned) {
        await db
            .update(messageTasksTable)
            .set({
                assigneeAgentId: null,
                assigneeUserId: null,
                claimedAt: null,
                updatedAt: sql`now()`,
                version: sql`${messageTasksTable.version} + 1`,
            })
            .where(
                and(
                    eq(messageTasksTable.serverId, serverId),
                    eq(messageTasksTable.messageId, task.messageId),
                    eq(assigneeColumn, actor.id)
                )
            );
        events.push(
            await insertTaskEvent(db, {
                chatId: task.chatId,
                messageId: task.messageId,
                serverId,
                type: 'task.updated',
            })
        );
    }

    return events;
}
