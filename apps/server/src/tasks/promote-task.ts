import type { HostedDurableEvent, HostedMessageTask } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable, chatsTable, messageTasksTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { ensureHostedThread } from '../threads/ensure-thread.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { insertHostedTaskEvent } from './task-events.ts';
import { findHostedMessageTask } from './task-shape.ts';

export class TaskMessageNotFoundError extends Error {
    constructor() {
        super('No taskable message exists in this Server with that id.');
        this.name = 'TaskMessageNotFoundError';
    }
}

export class UntaskableMessageError extends Error {
    constructor() {
        super('Only human or Agent messages in a top-level Channel or DM can become tasks.');
        this.name = 'UntaskableMessageError';
    }
}

export async function promoteHostedMessageTask(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { messageId: string; serverId: string }
): Promise<{ event: HostedDurableEvent | null; idempotent: boolean; task: HostedMessageTask }> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        if (!member) {
            throw new TaskMessageNotFoundError();
        }

        await tx.execute(sql`
            select user_id from server_memberships
            where server_id = ${input.serverId}
              and user_id = ${member.id}
              and revoked_at is null
            for update
        `);

        const [message] = await tx
            .select({
                chatId: chatMessagesTable.chatId,
                id: chatMessagesTable.id,
                systemAuthor: chatMessagesTable.systemAuthor,
            })
            .from(chatMessagesTable)
            .where(
                and(
                    eq(chatMessagesTable.serverId, input.serverId),
                    eq(chatMessagesTable.id, input.messageId)
                )
            )
            .limit(1);
        if (!message) {
            throw new TaskMessageNotFoundError();
        }

        const chat = await requireChatAccess(tx, member, {
            chatId: message.chatId,
            serverId: input.serverId,
        });
        if (chat.kind === 'thread' || message.systemAuthor) {
            throw new UntaskableMessageError();
        }

        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${message.chatId}
            for update
        `);

        const existing = await findHostedMessageTask(tx, input.serverId, input.messageId);
        if (existing) {
            return { event: null, idempotent: true, task: existing };
        }

        const [numberedChat] = await tx
            .update(chatsTable)
            .set({ lastTaskNumber: sql`${chatsTable.lastTaskNumber} + 1` })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, message.chatId)))
            .returning({ number: chatsTable.lastTaskNumber });
        if (!numberedChat) {
            throw new TaskMessageNotFoundError();
        }

        await ensureHostedThread(tx, member, {
            anchorMessageId: message.id,
            parentChatId: message.chatId,
            serverId: input.serverId,
        });
        await tx.insert(messageTasksTable).values({
            chatId: message.chatId,
            createdByUserId: member.id,
            messageId: message.id,
            number: numberedChat.number,
            origin: 'converted',
            serverId: input.serverId,
        });

        const task = await findHostedMessageTask(tx, input.serverId, input.messageId);
        if (!task) {
            throw new Error('Task promotion did not persist.');
        }
        const event = await insertHostedTaskEvent(tx, {
            chatId: message.chatId,
            messageId: message.id,
            serverId: input.serverId,
            type: 'task.created',
        });

        return { event, idempotent: false, task };
    });
}
