import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentInboxCursorsTable,
    agentInboxExactVisibilityTable,
    agentPendingWorkTable,
    agentsTable,
    chatMessagesTable,
    reminderAgentAttentionTable,
} from '../postgres/schema.ts';

export async function readAgentSessionGeneration(db: GrottoDatabase, agentId: string) {
    const [agent] = await db
        .select({ generation: agentsTable.sessionGeneration })
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
    if (!agent) {
        throw new Error('The Agent no longer exists.');
    }
    return agent.generation;
}

export async function readAgentInboxCursor(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; serverId: string }
) {
    const generation = await readAgentSessionGeneration(db, input.agentId);
    const [row] = await db
        .select()
        .from(agentInboxCursorsTable)
        .where(
            and(
                eq(agentInboxCursorsTable.serverId, input.serverId),
                eq(agentInboxCursorsTable.agentId, input.agentId),
                eq(agentInboxCursorsTable.sessionGeneration, generation),
                eq(agentInboxCursorsTable.chatId, input.chatId)
            )
        )
        .limit(1);
    return { generation, seen: row?.seenUpToSequence ?? 0 };
}

/** Advances only a verified contiguous model-visible boundary. */
export async function advanceSeenCursor(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; sequence: number; serverId: string }
) {
    if (!(Number.isInteger(input.sequence) && input.sequence > 0)) {
        return;
    }
    const generation = await readAgentSessionGeneration(db, input.agentId);
    await db
        .insert(agentInboxCursorsTable)
        .values({
            agentId: input.agentId,
            chatId: input.chatId,
            seenUpToSequence: input.sequence,
            serverId: input.serverId,
            sessionGeneration: generation,
        })
        .onConflictDoUpdate({
            set: {
                seenUpToSequence: sql`greatest(${agentInboxCursorsTable.seenUpToSequence}, ${input.sequence})`,
                updatedAt: new Date(),
            },
            target: [
                agentInboxCursorsTable.serverId,
                agentInboxCursorsTable.agentId,
                agentInboxCursorsTable.sessionGeneration,
                agentInboxCursorsTable.chatId,
            ],
        });
}

export async function recordExactMessagesServed(
    db: GrottoDatabase,
    input: {
        agentId: string;
        messages: Array<{ chatId: string; id: string }>;
        runId: string;
        serverId: string;
    }
) {
    if (input.messages.length === 0) {
        return;
    }
    const generation = await readAgentSessionGeneration(db, input.agentId);
    const servedAt = new Date();
    for (const message of input.messages) {
        await db
            .insert(agentInboxExactVisibilityTable)
            .values({
                agentId: input.agentId,
                chatId: message.chatId,
                messageId: message.id,
                servedAt,
                servedRunId: input.runId,
                serverId: input.serverId,
                sessionGeneration: generation,
            })
            .onConflictDoUpdate({
                set: { servedAt, servedRunId: input.runId },
                target: [
                    agentInboxExactVisibilityTable.serverId,
                    agentInboxExactVisibilityTable.agentId,
                    agentInboxExactVisibilityTable.sessionGeneration,
                    agentInboxExactVisibilityTable.chatId,
                    agentInboxExactVisibilityTable.messageId,
                ],
            });
    }
}

export async function advanceSeenForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string; serverId: string }
) {
    const generation = await readAgentSessionGeneration(db, input.agentId);
    const rows = await db
        .select({ chatId: agentPendingWorkTable.chatId, messageId: chatMessagesTable.id })
        .from(agentPendingWorkTable)
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, agentPendingWorkTable.serverId),
                eq(chatMessagesTable.id, agentPendingWorkTable.dedupeKey)
            )
        )
        .where(
            and(
                eq(agentPendingWorkTable.serverId, input.serverId),
                eq(agentPendingWorkTable.agentId, input.agentId),
                eq(agentPendingWorkTable.runId, input.runId),
                ne(agentPendingWorkTable.state, 'seen')
            )
        );
    await recordExactMessagesServed(db, {
        ...input,
        messages: rows.map((row) => ({ chatId: row.chatId, id: row.messageId })),
    });
    await db
        .update(agentInboxExactVisibilityTable)
        .set({ seenAt: new Date(), settledRunId: input.runId })
        .where(
            and(
                eq(agentInboxExactVisibilityTable.serverId, input.serverId),
                eq(agentInboxExactVisibilityTable.agentId, input.agentId),
                eq(agentInboxExactVisibilityTable.sessionGeneration, generation),
                eq(agentInboxExactVisibilityTable.servedRunId, input.runId)
            )
        );
    const messageIds = rows.map((row) => row.messageId);
    if (messageIds.length > 0) {
        await db
            .delete(reminderAgentAttentionTable)
            .where(
                and(
                    eq(reminderAgentAttentionTable.serverId, input.serverId),
                    eq(reminderAgentAttentionTable.agentId, input.agentId),
                    inArray(reminderAgentAttentionTable.receiptMessageId, messageIds)
                )
            );
    }
}

/** Retires queued rows covered by a verified contiguous seen boundary. */
export async function markCursorSubsumedSeen(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string }
) {
    const generation = await readAgentSessionGeneration(db, input.agentId);
    await db.execute(sql`
        update agent_pending_work pending
        set state = 'seen', seen_at = now()
        from chat_messages message, agent_inbox_cursors cursor
        where pending.server_id = ${input.serverId}
          and pending.agent_id = ${input.agentId}
          and pending.state = 'queued'
          and pending.run_id is null
          and message.server_id = pending.server_id
          and message.id = pending.dedupe_key
          and cursor.server_id = pending.server_id
          and cursor.agent_id = pending.agent_id
          and cursor.session_generation = ${generation}
          and cursor.chat_id = pending.chat_id
          and message.sequence <= cursor.seen_up_to_sequence
    `);
}
