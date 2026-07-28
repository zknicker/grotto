import { and, eq, inArray, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentInboxCursorsTable,
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
    return {
        delivered: row?.deliveredUpToSequence ?? 0,
        generation,
        seen: row?.seenUpToSequence ?? 0,
        served: row?.servedUpToSequence ?? 0,
    };
}

export async function advanceDeliveredCursor(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; sequence: number; serverId: string }
) {
    await advanceCursor(db, input, 'delivered');
}

export async function advanceSeenCursor(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; sequence: number; serverId: string }
) {
    await advanceCursor(db, input, 'seen');
}

export async function advanceServedCursor(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; sequence: number; serverId: string }
) {
    await advanceCursor(db, input, 'served');
}

export async function advanceSeenForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string; serverId: string }
) {
    const rows = await db
        .select({
            chatId: agentPendingWorkTable.chatId,
            messageId: chatMessagesTable.id,
            sequence: chatMessagesTable.sequence,
        })
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
                eq(agentPendingWorkTable.runId, input.runId)
            )
        );
    for (const row of rows) {
        await advanceSeenCursor(db, { ...input, ...row });
    }
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

/** Removes queued rows already exposed by a pull/hold in the current session. */
export async function deleteServedQueuedWork(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string }
) {
    const generation = await readAgentSessionGeneration(db, input.agentId);
    await db.execute(sql`
        delete from agent_pending_work pending
        using chat_messages message, agent_inbox_cursors cursor
        where pending.server_id = ${input.serverId}
          and pending.agent_id = ${input.agentId}
          and pending.run_id is null
          and message.server_id = pending.server_id
          and message.id = pending.dedupe_key
          and cursor.server_id = pending.server_id
          and cursor.agent_id = pending.agent_id
          and cursor.session_generation = ${generation}
          and cursor.chat_id = pending.chat_id
          and message.sequence <= greatest(
              cursor.seen_up_to_sequence,
              cursor.served_up_to_sequence
          )
    `);
}

async function advanceCursor(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; sequence: number; serverId: string },
    kind: 'delivered' | 'seen' | 'served'
) {
    if (!(Number.isInteger(input.sequence) && input.sequence > 0)) {
        return;
    }
    const generation = await readAgentSessionGeneration(db, input.agentId);
    const values = {
        agentId: input.agentId,
        chatId: input.chatId,
        deliveredUpToSequence: kind === 'delivered' ? input.sequence : 0,
        seenUpToSequence: kind === 'seen' ? input.sequence : 0,
        servedUpToSequence: kind === 'served' ? input.sequence : 0,
        serverId: input.serverId,
        sessionGeneration: generation,
    };
    const set =
        kind === 'delivered'
            ? {
                  deliveredUpToSequence: sql`greatest(${agentInboxCursorsTable.deliveredUpToSequence}, ${input.sequence})`,
                  updatedAt: new Date(),
              }
            : kind === 'seen'
              ? {
                    seenUpToSequence: sql`greatest(${agentInboxCursorsTable.seenUpToSequence}, ${input.sequence})`,
                    updatedAt: new Date(),
                }
              : {
                    servedUpToSequence: sql`greatest(${agentInboxCursorsTable.servedUpToSequence}, ${input.sequence})`,
                    updatedAt: new Date(),
                };
    await db
        .insert(agentInboxCursorsTable)
        .values(values)
        .onConflictDoUpdate({
            set,
            target: [
                agentInboxCursorsTable.serverId,
                agentInboxCursorsTable.agentId,
                agentInboxCursorsTable.sessionGeneration,
                agentInboxCursorsTable.chatId,
            ],
        });
}
