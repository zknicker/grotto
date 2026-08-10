import type { HostedDurableEvent, HostedMessageTask } from '@tavern/api';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { planAgentMessageRecipients } from '../agent-delivery/message-recipients.ts';
import { allocateHostedEventCursor } from '../chats/allocate-event-cursor.ts';
import { findHostedChatAccess, requireChatWriteAccess } from '../chats/chat-access.ts';
import { insertHostedSystemMessage } from '../chats/insert-system-message.ts';
import { ChatNonceConflictError, requireActiveDmPeer } from '../chats/send-message.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    chatEventsTable,
    chatMessagesTable,
    chatsTable,
    messageTasksTable,
    serverMembershipsTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { ensureHostedThread } from '../threads/ensure-thread.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { InvalidTaskAssigneeError, TaskAdminRequiredError } from './assign-task.ts';
import { HostedTaskNotFoundError } from './claim-task.ts';
import { UntaskableMessageError } from './promote-task.ts';
import { insertHostedTaskEvent } from './task-events.ts';
import { taskReceiptContent } from './task-receipts.ts';
import { findHostedMessageTask } from './task-shape.ts';

export interface CreateHostedTaskResult {
    events: HostedDurableEvent[];
    idempotent: boolean;
    task: HostedMessageTask;
    wakes: Array<{ agentId: string; serverId: string }>;
}

export async function createHostedTask(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: {
        assigneeUserId?: string;
        chatId: string;
        content: string;
        nonce: string;
        serverId: string;
    },
    agentDelivery: AgentDelivery
): Promise<CreateHostedTaskResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        if (!member) {
            throw new HostedTaskNotFoundError();
        }

        const membershipIds = [
            ...new Set(
                [member.id, input.assigneeUserId].filter(
                    (userId): userId is string => userId !== undefined
                )
            ),
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
        if (
            input.assigneeUserId &&
            input.assigneeUserId !== member.id &&
            server.role !== 'owner' &&
            server.role !== 'admin'
        ) {
            throw new TaskAdminRequiredError();
        }
        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${input.chatId}
            for update
        `);
        const chat = await requireChatWriteAccess(tx, member, input);
        if (chat.kind !== 'channel' && chat.kind !== 'dm') {
            throw new UntaskableMessageError();
        }
        const [existing] = await tx
            .select()
            .from(chatMessagesTable)
            .where(
                and(
                    eq(chatMessagesTable.serverId, input.serverId),
                    eq(chatMessagesTable.chatId, input.chatId),
                    eq(chatMessagesTable.nonce, input.nonce)
                )
            )
            .limit(1);
        if (existing) {
            if (existing.authorUserId !== member.id || existing.content !== input.content) {
                throw new ChatNonceConflictError();
            }
            const task = await findHostedMessageTask(tx, input.serverId, existing.id);
            if (!task) {
                throw new ChatNonceConflictError();
            }
            return { events: [], idempotent: true, task, wakes: [] };
        }
        await requireActiveDmPeer(tx, chat);
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
            if (!(active && (await findHostedChatAccess(tx, input.assigneeUserId, input)))) {
                throw new InvalidTaskAssigneeError();
            }
        }

        const [numberedChat] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: sql`now()`,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
                lastTaskNumber: sql`${chatsTable.lastTaskNumber} + 1`,
            })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
            .returning({
                messageSequence: chatsTable.lastMessageSequence,
                taskNumber: chatsTable.lastTaskNumber,
            });
        if (!numberedChat) {
            throw new Error('Failed to allocate task-message identity.');
        }

        const [message] = await tx
            .insert(chatMessagesTable)
            .values({
                authorUserId: member.id,
                chatId: input.chatId,
                content: input.content,
                id: createOpaqueId('msg'),
                nonce: input.nonce,
                sequence: numberedChat.messageSequence,
                serverId: input.serverId,
            })
            .returning();
        await ensureHostedThread(tx, member, {
            anchorMessageId: message.id,
            parentChatId: input.chatId,
            serverId: input.serverId,
        });

        const selfClaim = input.assigneeUserId === member.id;
        await tx.insert(messageTasksTable).values({
            assigneeUserId: input.assigneeUserId,
            chatId: input.chatId,
            claimedAt: selfClaim ? sql`now()` : null,
            createdByUserId: member.id,
            messageId: message.id,
            number: numberedChat.taskNumber,
            origin: 'composed',
            serverId: input.serverId,
            status: selfClaim ? 'in_progress' : 'todo',
        });

        const cursor = await allocateHostedEventCursor(tx, input.serverId);
        const [eventRow] = await tx
            .insert(chatEventsTable)
            .values({
                chatId: input.chatId,
                cursor,
                id: createOpaqueId('evt'),
                messageId: message.id,
                sequence: message.sequence,
                serverId: input.serverId,
                type: 'message.created',
            })
            .returning({ createdAt: chatEventsTable.createdAt, id: chatEventsTable.id });
        const task = await findHostedMessageTask(tx, input.serverId, message.id);
        if (!task) {
            throw new Error('Task creation did not persist.');
        }

        const messageEvent: HostedDurableEvent = {
            chatId: input.chatId,
            createdAt: eventRow.createdAt.toISOString(),
            cursor: cursor.toString(),
            id: eventRow.id,
            messageId: message.id,
            parentChatId: null,
            sequence: message.sequence,
            serverId: input.serverId,
            type: 'message.created',
        };
        const taskEvent = await insertHostedTaskEvent(tx, {
            chatId: input.chatId,
            messageId: message.id,
            serverId: input.serverId,
            type: 'task.created',
        });
        const receiptContent = taskReceiptContent({
            kind: 'created',
            tasks: [{ number: task.number, title: input.content }],
        });
        if (!receiptContent) {
            throw new Error('Task creation did not produce a receipt.');
        }
        const receiptEvent = await insertHostedSystemMessage(tx, {
            chatId: input.chatId,
            content: receiptContent,
            nonce: `task-receipt:${input.nonce}`,
            serverId: input.serverId,
            systemAuthor: 'task',
        });
        const recipients = await planAgentMessageRecipients(tx, {
            authorAgentId: null,
            chatId: input.chatId,
            content: input.content,
            serverId: input.serverId,
        });
        for (const recipient of recipients) {
            await agentDelivery.enqueue(tx, {
                agentId: recipient.agentId,
                chatId: input.chatId,
                content: input.content,
                dedupeKey: message.id,
                pierced: recipient.pierced,
                sequence: message.sequence,
                serverId: input.serverId,
                source: 'human',
            });
        }

        return {
            events: [messageEvent, taskEvent, receiptEvent],
            idempotent: false,
            task,
            wakes: recipients.map(({ agentId }) => ({ agentId, serverId: input.serverId })),
        };
    });
}
