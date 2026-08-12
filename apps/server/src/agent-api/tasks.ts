import type { HostedDurableEvent } from '@tavern/api';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { planAgentMessageRecipients } from '../agent-delivery/message-recipients.ts';
import { allocateHostedEventCursor } from '../chats/allocate-event-cursor.ts';
import { requireHostedChatWritable } from '../chats/chat-access.ts';
import { insertHostedSystemMessage } from '../chats/insert-system-message.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    agentThreadFollowsTable,
    channelAgentParticipantsTable,
    chatEventsTable,
    chatMessagesTable,
    chatsTable,
    messageTasksTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { insertHostedTaskEvent } from '../tasks/task-events.ts';
import { agentOwnsTask, taskHasOtherOwnerForAgent } from '../tasks/task-ownership.ts';
import { taskReceiptContent } from '../tasks/task-receipts.ts';
import { ensureHostedThreadRecord } from '../threads/ensure-thread.ts';
import { resolveAgentMessage } from './message-read.ts';
import {
    type MessageRow,
    messageSelection,
    targetForChat,
    toAgentMessages,
    visibleChatSql,
} from './message-view.ts';
import { AgentTargetError, resolveAgentTarget } from './resolve-target.ts';
import { hasUnseenTaskThreadContext } from './task-freshness.ts';

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';

export async function listAgentTasks(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { status?: TaskStatus; target?: string }
) {
    const chatId = input.target ? await resolveAgentTarget(db, runner, input.target) : null;
    const rows = await db
        .select({ message: messageSelection, task: messageTasksTable })
        .from(messageTasksTable)
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, messageTasksTable.serverId),
                eq(chatMessagesTable.id, messageTasksTable.messageId)
            )
        )
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, messageTasksTable.serverId),
                eq(chatsTable.id, messageTasksTable.chatId)
            )
        )
        .where(
            and(
                eq(messageTasksTable.serverId, runner.serverId),
                chatId ? eq(messageTasksTable.chatId, chatId) : visibleChatSql(runner),
                input.status ? eq(messageTasksTable.status, input.status) : undefined
            )
        )
        .orderBy(desc(messageTasksTable.updatedAt));
    return {
        tasks: await Promise.all(
            rows.map(async (row) => taskRow(db, runner, row.message, row.task))
        ),
    };
}

export async function createAgentTasks(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: {
        assignee?: string;
        content?: string;
        nonce: string;
        target: string;
        titles?: string[];
    },
    agentDelivery: AgentDelivery
) {
    const titles = input.titles?.length ? input.titles : input.content ? [input.content] : [];
    if (titles.length === 0 || titles.some((title) => !title.trim())) {
        throw new AgentTaskError('Task content is required.');
    }
    const chatId = await resolveAgentTarget(db, runner, input.target);
    const assigneeAgentId = input.assignee
        ? await resolveTaskAssignee(db, runner, chatId, input.assignee)
        : null;
    const selfClaim = assigneeAgentId === runner.agentId;
    const nonces = titles.map((_, index) => `${input.nonce}:${index}`);
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        await requireHostedChatWritable(tx, { chatId, serverId: runner.serverId });
        const replay = await replayAgentTasks(tx, runner, chatId, titles, nonces, assigneeAgentId);
        if (replay) {
            return { events: [], tasks: replay, wakes: [] };
        }
        const created: Awaited<ReturnType<typeof taskRow>>[] = [];
        const events: HostedDurableEvent[] = [];
        const wakes = new Set<string>();
        for (const [index, title] of titles.entries()) {
            const [numberedChat] = await tx
                .update(chatsTable)
                .set({
                    lastActivityAt: sql`now()`,
                    lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
                    lastTaskNumber: sql`${chatsTable.lastTaskNumber} + 1`,
                })
                .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, chatId)))
                .returning({
                    messageSequence: chatsTable.lastMessageSequence,
                    taskNumber: chatsTable.lastTaskNumber,
                });
            if (!numberedChat) {
                throw new AgentTaskError('That task target no longer exists.');
            }
            const [message] = await tx
                .insert(chatMessagesTable)
                .values({
                    authorAgentId: runner.agentId,
                    chatId,
                    content: title.trim(),
                    id: createOpaqueId('msg'),
                    nonce: nonces[index],
                    sequence: numberedChat.messageSequence,
                    serverId: runner.serverId,
                })
                .returning(messageSelection);
            await tx.insert(messageTasksTable).values({
                assigneeAgentId,
                chatId,
                claimedAt: selfClaim ? sql`now()` : null,
                createdByAgentId: runner.agentId,
                messageId: message.id,
                number: numberedChat.taskNumber,
                origin: 'composed',
                serverId: runner.serverId,
                status: selfClaim ? 'in_progress' : 'todo',
            });
            await createAgentTaskThread(
                tx,
                runner,
                chatId,
                message.id,
                assigneeAgentId ?? runner.agentId
            );
            const recipients = await planAgentMessageRecipients(tx, {
                authorAgentId: runner.agentId,
                chatId,
                content: title.trim(),
                serverId: runner.serverId,
            });
            if (assigneeAgentId && assigneeAgentId !== runner.agentId) {
                recipients.push({ agentId: assigneeAgentId, pierced: true });
            }
            for (const recipient of dedupeRecipients(recipients)) {
                await agentDelivery.enqueue(tx, {
                    agentId: recipient.agentId,
                    chatId,
                    content: title.trim(),
                    dedupeKey: message.id,
                    pierced: recipient.pierced,
                    sequence: message.sequence,
                    serverId: runner.serverId,
                    source: `agent:${await agentHandle(tx, runner)}`,
                });
                wakes.add(recipient.agentId);
            }
            events.push(
                await insertAgentMessageCreatedEvent(tx, {
                    chatId,
                    messageId: message.id,
                    sequence: message.sequence,
                    serverId: runner.serverId,
                }),
                await insertHostedTaskEvent(tx, {
                    chatId,
                    messageId: message.id,
                    serverId: runner.serverId,
                    type: 'task.created',
                })
            );
            const [task] = await tx
                .select()
                .from(messageTasksTable)
                .where(
                    and(
                        eq(messageTasksTable.serverId, runner.serverId),
                        eq(messageTasksTable.messageId, message.id)
                    )
                );
            created.push(await taskRow(tx, runner, message, task));
        }
        const receiptContent = taskReceiptContent({
            kind: 'created',
            tasks: created.map((task) => ({ number: task.number, title: task.message.content })),
        });
        if (!receiptContent) {
            throw new AgentTaskError('Task creation did not produce a receipt.');
        }
        events.push(
            await insertHostedSystemMessage(tx, {
                chatId,
                content: receiptContent,
                nonce: `task-receipt:${input.nonce}`,
                serverId: runner.serverId,
                systemAuthor: 'task',
            })
        );
        return {
            events,
            tasks: created,
            wakes: [...wakes].map((agentId) => ({ agentId, serverId: runner.serverId })),
        };
    });
}

export async function claimAgentTasks(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { messageId?: string; numbers?: number[]; target: string }
) {
    const chatId = await resolveAgentTarget(db, runner, input.target);
    const messageId = input.messageId
        ? (await resolveAgentMessage(db, runner, input.messageId)).id
        : undefined;
    let tasks = await queryAgentTasks(db, runner, chatId, {
        ...input,
        messageId,
    });
    const events: HostedDurableEvent[] = [];
    if (tasks.length === 0 && messageId) {
        const promoted = await promoteAgentMessageTask(db, runner, chatId, messageId);
        tasks = [promoted.task];
        events.push(...promoted.events);
    }
    if (tasks.length === 0) {
        throw new AgentTaskError('No matching task exists in that target.');
    }
    const claimed: Awaited<ReturnType<typeof taskRow>>[] = [];
    for (const task of tasks) {
        const result = await mutateAgentTask(db, runner, task.messageId, task.version, 'claim');
        claimed.push(result.task);
        if (result.event) {
            events.push(result.event);
        }
    }
    return { claimed, events };
}

export async function unclaimAgentTask(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { number: number; target: string }
) {
    const chatId = await resolveAgentTarget(db, runner, input.target);
    const [task] = await findAgentTasks(db, runner, chatId, { numbers: [input.number] });
    return await mutateAgentTask(db, runner, task.messageId, task.version, 'unclaim');
}

export async function updateAgentTask(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { number: number; status: TaskStatus; target: string }
) {
    const chatId = await resolveAgentTarget(db, runner, input.target);
    const [task] = await findAgentTasks(db, runner, chatId, { numbers: [input.number] });
    return await mutateAgentTask(db, runner, task.messageId, task.version, 'update', input.status);
}

async function mutateAgentTask(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    messageId: string,
    expectedVersion: number,
    action: 'claim' | 'unclaim' | 'update',
    status?: TaskStatus
) {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const [current] = await tx
            .select()
            .from(messageTasksTable)
            .where(
                and(
                    eq(messageTasksTable.serverId, runner.serverId),
                    eq(messageTasksTable.messageId, messageId)
                )
            )
            .for('update');
        if (!current) {
            throw new AgentTaskError('That task no longer exists.');
        }
        await requireHostedChatWritable(tx, {
            chatId: current.chatId,
            serverId: runner.serverId,
        });
        if (
            action === 'claim' &&
            current.assigneeAgentId === runner.agentId &&
            current.claimedAt !== null
        ) {
            const [message] = await tx
                .select(messageSelection)
                .from(chatMessagesTable)
                .where(
                    and(
                        eq(chatMessagesTable.serverId, runner.serverId),
                        eq(chatMessagesTable.id, messageId)
                    )
                );
            return { event: null, task: await taskRow(tx, runner, message, current) };
        }
        if (current.version !== expectedVersion) {
            throw new AgentTaskError('That task changed; refresh it before updating.');
        }
        if (
            (action === 'claim' || action === 'update') &&
            (await hasUnseenTaskThreadContext(tx, runner, messageId))
        ) {
            throw new AgentTaskError(
                'New context exists in this task thread. Run grotto message check before retrying.'
            );
        }
        if (action === 'claim' && taskHasOtherOwnerForAgent(current, runner.agentId)) {
            throw new AgentTaskError('That task is already owned by another assignee.');
        }
        if (action === 'unclaim' && current.assigneeAgentId !== runner.agentId) {
            throw new AgentTaskError('Only the current assignee may unclaim this task.');
        }
        if (
            action === 'update' &&
            (!agentOwnsTask(current, runner.agentId) || current.claimedAt === null)
        ) {
            throw new AgentTaskError('Only the current assignee may update this task.');
        }
        if ((action === 'claim' || action === 'unclaim') && current.status === 'done') {
            throw new AgentTaskError('Done tasks cannot be claimed or unclaimed.');
        }
        const [updated] = await tx
            .update(messageTasksTable)
            .set({
                ...(action === 'claim'
                    ? {
                          assigneeAgentId: runner.agentId,
                          assigneeUserId: null,
                          claimedAt: sql`now()`,
                          status: current.status === 'todo' ? 'in_progress' : current.status,
                      }
                    : {}),
                ...(action === 'unclaim'
                    ? { assigneeAgentId: null, assigneeUserId: null, claimedAt: null }
                    : {}),
                ...(action === 'update' ? { status } : {}),
                updatedAt: sql`now()`,
                version: sql`${messageTasksTable.version} + 1`,
            })
            .where(
                and(
                    eq(messageTasksTable.serverId, runner.serverId),
                    eq(messageTasksTable.messageId, messageId),
                    eq(messageTasksTable.version, expectedVersion)
                )
            )
            .returning({ version: messageTasksTable.version });
        if (!updated) {
            throw new AgentTaskError('That task changed; refresh it before updating.');
        }
        const event = await insertHostedTaskEvent(tx, {
            chatId: current.chatId,
            messageId: current.messageId,
            serverId: runner.serverId,
            type: 'task.updated',
        });
        const [next] = await tx
            .select()
            .from(messageTasksTable)
            .where(
                and(
                    eq(messageTasksTable.serverId, runner.serverId),
                    eq(messageTasksTable.messageId, messageId)
                )
            );
        const [message] = await tx
            .select(messageSelection)
            .from(chatMessagesTable)
            .where(
                and(
                    eq(chatMessagesTable.serverId, runner.serverId),
                    eq(chatMessagesTable.id, messageId)
                )
            );
        return { event, task: await taskRow(tx, runner, message, next) };
    });
}

async function findAgentTasks(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    input: { messageId?: string; numbers?: number[] }
) {
    const rows = await queryAgentTasks(db, runner, chatId, input);
    if (rows.length === 0) {
        throw new AgentTaskError('No matching task exists in that target.');
    }
    return rows;
}

async function queryAgentTasks(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    input: { messageId?: string; numbers?: number[] }
) {
    return await db
        .select()
        .from(messageTasksTable)
        .where(
            and(
                eq(messageTasksTable.serverId, runner.serverId),
                eq(messageTasksTable.chatId, chatId),
                input.messageId ? eq(messageTasksTable.messageId, input.messageId) : undefined,
                input.numbers?.length ? inArray(messageTasksTable.number, input.numbers) : undefined
            )
        );
}

async function promoteAgentMessageTask(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    messageId: string
) {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        await requireHostedChatWritable(tx, { chatId, serverId: runner.serverId });
        const [message] = await tx
            .select({
                chatId: chatMessagesTable.chatId,
                content: chatMessagesTable.content,
                id: chatMessagesTable.id,
            })
            .from(chatMessagesTable)
            .where(
                and(
                    eq(chatMessagesTable.serverId, runner.serverId),
                    eq(chatMessagesTable.chatId, chatId),
                    eq(chatMessagesTable.id, messageId)
                )
            )
            .limit(1);
        if (!message) {
            throw new AgentTaskError('That message is not in the selected target.');
        }
        const existing = await queryAgentTasks(tx, runner, chatId, { messageId });
        if (existing[0]) {
            return { events: [], task: existing[0] };
        }
        const [numberedChat] = await tx
            .update(chatsTable)
            .set({ lastTaskNumber: sql`${chatsTable.lastTaskNumber} + 1` })
            .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, chatId)))
            .returning({ number: chatsTable.lastTaskNumber });
        if (!numberedChat) {
            throw new AgentTaskError('That task target no longer exists.');
        }
        await tx.insert(messageTasksTable).values({
            assigneeAgentId: runner.agentId,
            chatId,
            claimedAt: sql`now()`,
            createdByAgentId: runner.agentId,
            messageId,
            number: numberedChat.number,
            origin: 'converted',
            serverId: runner.serverId,
            status: 'in_progress',
        });
        await createAgentTaskThread(tx, runner, chatId, messageId);
        const [created] = await queryAgentTasks(tx, runner, chatId, { messageId });
        if (!created) {
            throw new Error('Task conversion did not persist.');
        }
        const event = await insertHostedTaskEvent(tx, {
            chatId,
            messageId,
            serverId: runner.serverId,
            type: 'task.created',
        });
        const receiptContent = taskReceiptContent({
            actorLabel: `@${await agentHandle(tx, runner)}`,
            kind: 'converted',
            tasks: [{ number: created.number, title: message.content }],
        });
        if (!receiptContent) {
            throw new AgentTaskError('Task conversion did not produce a receipt.');
        }
        const receiptEvent = await insertHostedSystemMessage(tx, {
            chatId,
            content: receiptContent,
            nonce: `task-receipt:${messageId}`,
            serverId: runner.serverId,
            systemAuthor: 'task',
        });
        return { events: [event, receiptEvent], task: created };
    });
}

async function taskRow(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    messageRow: MessageRow,
    task: typeof messageTasksTable.$inferSelect
) {
    const [message] = await toAgentMessages(db, runner.serverId, [messageRow]);
    const assignee = task.assigneeAgentId
        ? {
              handle: await agentHandle(db, { ...runner, agentId: task.assigneeAgentId }),
              id: task.assigneeAgentId,
          }
        : task.assigneeUserId
          ? { handle: null, id: task.assigneeUserId }
          : null;
    return {
        assignee,
        message,
        number: task.number,
        status: task.status,
        target: await targetForChat(db, runner.serverId, task.chatId),
        version: task.version,
    };
}

async function insertAgentMessageCreatedEvent(
    db: GrottoDatabase,
    input: { chatId: string; messageId: string; sequence: number; serverId: string }
): Promise<HostedDurableEvent> {
    const cursor = await allocateHostedEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'message.created',
        })
        .returning({ createdAt: chatEventsTable.createdAt, id: chatEventsTable.id });

    return {
        chatId: input.chatId,
        createdAt: event.createdAt.toISOString(),
        cursor: cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: null,
        sequence: input.sequence,
        serverId: input.serverId,
        type: 'message.created',
    };
}

async function createAgentTaskThread(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    parentChatId: string,
    messageId: string,
    followingAgentId = runner.agentId
) {
    const [parent] = await db
        .select({ kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, parentChatId)));
    if (!parent || parent.kind === 'thread') {
        throw new AgentTaskError('Tasks require a top-level Channel or DM.');
    }
    const thread = await ensureHostedThreadRecord(db, {
        anchorMessageId: messageId,
        parentChatId,
        serverId: runner.serverId,
    });
    const threadChatId = thread.id;
    await db
        .insert(agentThreadFollowsTable)
        .values({
            agentId: runner.agentId,
            followed: true,
            serverId: runner.serverId,
            threadChatId,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            set: { followed: true, updatedAt: new Date() },
            target: [
                agentThreadFollowsTable.serverId,
                agentThreadFollowsTable.agentId,
                agentThreadFollowsTable.threadChatId,
            ],
        });
    if (followingAgentId !== runner.agentId) {
        await db
            .insert(agentThreadFollowsTable)
            .values({
                agentId: followingAgentId,
                followed: true,
                serverId: runner.serverId,
                threadChatId,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                set: { followed: true, updatedAt: new Date() },
                target: [
                    agentThreadFollowsTable.serverId,
                    agentThreadFollowsTable.agentId,
                    agentThreadFollowsTable.threadChatId,
                ],
            });
    }
}

async function resolveTaskAssignee(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    value: string
) {
    const handle = stripAt(value);
    const [agent] = await db
        .select({ id: agentsTable.id })
        .from(agentsTable)
        .where(
            and(
                eq(agentsTable.serverId, runner.serverId),
                eq(agentsTable.handle, handle),
                isNull(agentsTable.retiredAt)
            )
        )
        .limit(1);
    if (!agent) {
        throw new AgentTaskError(`No active Agent has handle @${handle}.`);
    }
    if (agent.id === runner.agentId) {
        return agent.id;
    }
    const [joined] = await db
        .select({ agentId: channelAgentParticipantsTable.agentId })
        .from(channelAgentParticipantsTable)
        .where(
            and(
                eq(channelAgentParticipantsTable.serverId, runner.serverId),
                eq(channelAgentParticipantsTable.chatId, chatId),
                eq(channelAgentParticipantsTable.agentId, agent.id)
            )
        )
        .limit(1);
    if (!joined) {
        throw new AgentTaskError('The assigned Agent must belong to the target Channel.');
    }
    return agent.id;
}

async function replayAgentTasks(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    titles: string[],
    nonces: string[],
    assigneeAgentId: string | null
) {
    const existing = await db
        .select(messageSelection)
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                eq(chatMessagesTable.chatId, chatId),
                inArray(chatMessagesTable.nonce, nonces)
            )
        );
    if (existing.length === 0) {
        return null;
    }
    if (existing.length !== titles.length) {
        throw new AgentTaskError('That task creation nonce belongs to an incomplete replay.');
    }
    const byNonce = new Map(existing.map((message) => [message.nonce, message]));
    return await Promise.all(
        titles.map(async (title, index) => {
            const message = byNonce.get(nonces[index] ?? '');
            if (message?.authorAgentId !== runner.agentId || message.content !== title.trim()) {
                throw new AgentTaskError('That task creation nonce belongs to different content.');
            }
            const [task] = await queryAgentTasks(db, runner, chatId, { messageId: message.id });
            if (!task) {
                throw new AgentTaskError('That task creation nonce has no canonical task.');
            }
            if (task.assigneeAgentId !== assigneeAgentId) {
                throw new AgentTaskError(
                    'That task creation nonce belongs to a different assignee.'
                );
            }
            return await taskRow(db, runner, message, task);
        })
    );
}

function dedupeRecipients(recipients: Array<{ agentId: string; pierced: boolean }>) {
    const byAgent = new Map<string, { agentId: string; pierced: boolean }>();
    for (const recipient of recipients) {
        const current = byAgent.get(recipient.agentId);
        byAgent.set(recipient.agentId, {
            agentId: recipient.agentId,
            pierced: Boolean(current?.pierced || recipient.pierced),
        });
    }
    return [...byAgent.values()];
}

async function agentHandle(
    db: GrottoDatabase,
    runner: Pick<ResolvedRunner, 'agentId' | 'serverId'>
) {
    const [agent] = await db
        .select({ handle: agentsTable.handle })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, runner.serverId), eq(agentsTable.id, runner.agentId)));
    if (!agent) {
        throw new AgentTargetError('This Agent no longer exists.');
    }
    return agent.handle;
}

function stripAt(value: string) {
    return value.startsWith('@') ? value.slice(1) : value;
}

export class AgentTaskError extends Error {}
