import type { TavernAgentMessage } from '@tavern/api';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { readMessageAttachments } from '../attachments/message-attachments.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    messageReactionsTable,
} from '../postgres/schema.ts';
import { listMessageTaskMap } from '../tasks/task-shape.ts';

export interface MessageRow {
    authorAgentId: string | null;
    authorUserId: string | null;
    chatId: string;
    content: string;
    createdAt: Date;
    id: string;
    nonce: string;
    sequence: number;
    systemAuthor: 'reminder' | 'session' | 'task' | null;
}

export const messageSelection = {
    authorAgentId: chatMessagesTable.authorAgentId,
    authorUserId: chatMessagesTable.authorUserId,
    chatId: chatMessagesTable.chatId,
    content: chatMessagesTable.content,
    createdAt: chatMessagesTable.createdAt,
    id: chatMessagesTable.id,
    nonce: chatMessagesTable.nonce,
    sequence: chatMessagesTable.sequence,
    systemAuthor: chatMessagesTable.systemAuthor,
};

export async function toAgentMessages(
    db: GrottoDatabase,
    serverId: string,
    rows: MessageRow[]
): Promise<TavernAgentMessage[]> {
    const tasksByMessage = await listMessageTaskMap(
        db,
        serverId,
        rows.map(({ id }) => id)
    );
    const agentIds = [
        ...new Set(
            rows
                .flatMap((row) => row.authorAgentId ?? [])
                .concat([...tasksByMessage.values()].flatMap((task) => task.assigneeAgentId ?? []))
        ),
    ];
    const agents =
        agentIds.length === 0
            ? []
            : await db
                  .select({
                      description: agentsTable.description,
                      displayName: agentsTable.displayName,
                      handle: agentsTable.handle,
                      id: agentsTable.id,
                  })
                  .from(agentsTable)
                  .where(
                      and(eq(agentsTable.serverId, serverId), inArray(agentsTable.id, agentIds))
                  );
    const agentById = new Map(agents.map((agent) => [agent.id, agent]));
    const attachmentsByMessage = await readMessageAttachments(
        db,
        serverId,
        rows.map(({ id }) => id)
    );
    const reactionsByMessage = await readMessageReactions(
        db,
        serverId,
        rows.map(({ id }) => id)
    );
    return rows.map((row) => {
        const agent = row.authorAgentId ? agentById.get(row.authorAgentId) : undefined;
        const system = row.systemAuthor !== null;
        const handle =
            agent?.handle ?? (row.systemAuthor === 'task' ? 'system' : system ? null : 'operator');
        const label = agent?.displayName ?? (system ? 'Grotto' : 'Operator');
        const task = tasksByMessage.get(row.id);
        const taskAssigneeAgent = task?.assigneeAgentId
            ? agentById.get(task.assigneeAgentId)
            : undefined;
        return {
            attachments: attachmentsByMessage.get(row.id) ?? [],
            author: {
                id: row.authorAgentId ?? row.authorUserId ?? 'system',
                kind: system ? 'system' : agent ? 'agent' : 'user',
                label,
                metadata: {},
            },
            chat_id: row.chatId,
            content: row.content,
            created_at: row.createdAt.toISOString(),
            deleted_at: null,
            delivery_id: null,
            id: row.id,
            metadata: {},
            nonce: row.nonce,
            role: system ? 'system' : agent ? 'assistant' : 'user',
            reactions: reactionsByMessage.get(row.id) ?? [],
            sender: {
                description: agent?.description ?? null,
                handle,
                type: system ? 'system' : agent ? 'agent' : 'human',
            },
            sequence: row.sequence,
            ...(task
                ? {
                      task: {
                          assignee: task.assigneeAgentId
                              ? {
                                    handle: taskAssigneeAgent?.handle ?? null,
                                    id: task.assigneeAgentId,
                                }
                              : task.assigneeUserId
                                ? { handle: null, id: task.assigneeUserId }
                                : null,
                          claimed_at: task.claimedAt,
                          created_at: task.createdAt,
                          labels: task.labels,
                          number: task.number,
                          origin: task.origin,
                          priority: task.priority,
                          status: task.status,
                          updated_at: task.updatedAt,
                      },
                  }
                : {}),
        };
    });
}

async function readMessageReactions(db: GrottoDatabase, serverId: string, messageIds: string[]) {
    const byMessage = new Map<
        string,
        Array<{ actors: Array<{ handle: string; id: string }>; emoji: string }>
    >();
    if (messageIds.length === 0) {
        return byMessage;
    }
    const rows = await db
        .select({
            actorId: messageReactionsTable.actorAgentId,
            emoji: messageReactionsTable.emoji,
            handle: agentsTable.handle,
            messageId: messageReactionsTable.messageId,
        })
        .from(messageReactionsTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, messageReactionsTable.serverId),
                eq(agentsTable.id, messageReactionsTable.actorAgentId)
            )
        )
        .where(
            and(
                eq(messageReactionsTable.serverId, serverId),
                inArray(messageReactionsTable.messageId, messageIds)
            )
        );
    for (const row of rows) {
        const reactions = byMessage.get(row.messageId) ?? [];
        const reaction = reactions.find(({ emoji }) => emoji === row.emoji);
        if (reaction) {
            reaction.actors.push({ handle: row.handle, id: row.actorId });
        } else {
            reactions.push({
                actors: [{ handle: row.handle, id: row.actorId }],
                emoji: row.emoji,
            });
        }
        byMessage.set(row.messageId, reactions);
    }
    return byMessage;
}

export async function targetForChat(
    db: GrottoDatabase,
    serverId: string,
    chatId: string
): Promise<string> {
    const [chat] = await db
        .select({
            anchorMessageId: chatsTable.anchorMessageId,
            kind: chatsTable.kind,
            name: chatsTable.name,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), eq(chatsTable.id, chatId)))
        .limit(1);
    if (!chat || chat.kind === 'dm') {
        return 'dm:@operator';
    }
    if (chat.kind === 'channel') {
        return `#${chat.name}`;
    }
    const parent = chat.parentChatId
        ? await targetForChat(db, serverId, chat.parentChatId)
        : '#unknown';
    return `${parent}:${shortMessageId(chat.anchorMessageId ?? '')}`;
}

export function visibleChatSql(runner: ResolvedRunner) {
    return sql`(
        (${chatsTable.kind} = 'dm' and ${chatsTable.dmAgentId} = ${runner.agentId})
        or (
            ${chatsTable.kind} = 'channel'
            and exists (
                select 1 from channel_agent_participants cap
                where cap.server_id = ${runner.serverId}
                  and cap.chat_id = ${chatsTable.id}
                  and cap.agent_id = ${runner.agentId}
            )
        )
        or (
            ${chatsTable.kind} = 'thread'
            and (
                exists (
                    select 1 from channel_agent_participants cap
                    where cap.server_id = ${runner.serverId}
                      and cap.chat_id = ${chatsTable.parentChatId}
                      and cap.agent_id = ${runner.agentId}
                )
                or exists (
                    select 1 from chats parent_dm
                    where parent_dm.server_id = ${runner.serverId}
                      and parent_dm.id = ${chatsTable.parentChatId}
                      and parent_dm.kind = 'dm'
                      and parent_dm.dm_agent_id = ${runner.agentId}
                )
            )
        )
    )`;
}

function shortMessageId(id: string) {
    return id.startsWith('msg_') ? id.slice(4, 12) : id;
}
