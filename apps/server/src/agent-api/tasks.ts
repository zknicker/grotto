import type { HostedDurableEvent } from '@tavern/api';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { allocateHostedEventCursor } from '../chats/allocate-event-cursor.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    agentThreadFollowsTable,
    chatEventsTable,
    chatMessagesTable,
    chatsTable,
    messageTasksTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { insertHostedTaskEvent } from '../tasks/task-events.ts';
import { resolveAgentMessage } from './message-read.ts';
import {
    type MessageRow,
    messageSelection,
    targetForChat,
    toAgentMessages,
    visibleChatSql,
} from './message-view.ts';
import { AgentTargetError, resolveAgentTarget } from './resolve-target.ts';

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
    input: { assignee?: string; content?: string; target: string; titles?: string[] }
) {
    const titles = input.titles?.length ? input.titles : input.content ? [input.content] : [];
    if (titles.length === 0 || titles.some((title) => !title.trim())) {
        throw new AgentTaskError('Task content is required.');
    }
    if (input.assignee && stripAt(input.assignee) !== (await agentHandle(db, runner))) {
        throw new AgentTaskError('An Agent may assign a task only to itself.');
    }
    const chatId = await resolveAgentTarget(db, runner, input.target);
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const created: Awaited<ReturnType<typeof taskRow>>[] = [];
        const events: HostedDurableEvent[] = [];
        for (const title of titles) {
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
                    nonce: createOpaqueId('nonce'),
                    sequence: numberedChat.messageSequence,
                    serverId: runner.serverId,
                })
                .returning(messageSelection);
            const selfClaim = Boolean(input.assignee);
            await tx.insert(messageTasksTable).values({
                assigneeAgentId: selfClaim ? runner.agentId : null,
                chatId,
                claimedAt: selfClaim ? sql`now()` : null,
                createdByAgentId: runner.agentId,
                messageId: message.id,
                number: numberedChat.taskNumber,
                origin: 'composed',
                serverId: runner.serverId,
                status: selfClaim ? 'in_progress' : 'todo',
            });
            await createAgentTaskThread(tx, runner, chatId, message.id);
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
        return { events, tasks: created };
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
        if (promoted.event) {
            events.push(promoted.event);
        }
    }
    if (tasks.length === 0) {
        throw new AgentTaskError('No matching task exists in that target.');
    }
    const claimed: Awaited<ReturnType<typeof taskRow>>[] = [];
    for (const task of tasks) {
        const result = await mutateAgentTask(db, runner, task.messageId, task.version, 'claim');
        claimed.push(result.task);
        events.push(result.event);
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
        if (current.version !== expectedVersion) {
            throw new AgentTaskError('That task changed; refresh it before updating.');
        }
        if (
            action === 'claim' &&
            current.assigneeAgentId &&
            current.assigneeAgentId !== runner.agentId
        ) {
            throw new AgentTaskError('That task is already claimed by another Agent.');
        }
        if (action === 'unclaim' && current.assigneeAgentId !== runner.agentId) {
            throw new AgentTaskError('Only the current assignee may unclaim this task.');
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
        const [message] = await tx
            .select({ chatId: chatMessagesTable.chatId, id: chatMessagesTable.id })
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
            return { event: null, task: existing[0] };
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
        return { event, task: created };
    });
}

async function taskRow(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    messageRow: MessageRow,
    task: typeof messageTasksTable.$inferSelect
) {
    const [message] = await toAgentMessages(db, runner.serverId, [messageRow]);
    const handle = task.assigneeAgentId
        ? await agentHandle(db, { ...runner, agentId: task.assigneeAgentId })
        : null;
    return {
        assignee: handle,
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
    messageId: string
) {
    const [parent] = await db
        .select({ kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, parentChatId)));
    if (!parent || parent.kind === 'thread') {
        throw new AgentTaskError('Tasks require a top-level Channel or DM.');
    }
    const threadChatId = `cht_thr_${messageId.replace(/^msg_/u, '')}`;
    await db.insert(chatsTable).values({
        anchorMessageId: messageId,
        id: threadChatId,
        kind: 'thread',
        parentChatId,
        parentChatKind: parent.kind,
        serverId: runner.serverId,
    });
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
