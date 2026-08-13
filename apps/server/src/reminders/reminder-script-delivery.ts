import type { ReminderScriptCommand, ReminderScriptResult, ServerDurableEvent } from '@tavern/api';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    reminderAgentAttentionTable,
    reminderFiresTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { insertMessageEvent } from './reminder-model.ts';

export async function listReminderScriptCommands(
    db: GrottoDatabase,
    computerId: string
): Promise<ReminderScriptCommand[]> {
    const rows = await db
        .select({
            agentId: reminderAgentAttentionTable.agentId,
            attentionId: reminderAgentAttentionTable.id,
            fireId: reminderAgentAttentionTable.fireId,
            reminderId: reminderAgentAttentionTable.reminderId,
            script: reminderAgentAttentionTable.script,
        })
        .from(reminderAgentAttentionTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, reminderAgentAttentionTable.serverId),
                eq(agentsTable.id, reminderAgentAttentionTable.agentId),
                eq(agentsTable.computerId, computerId)
            )
        )
        .where(eq(reminderAgentAttentionTable.kind, 'reminder_script'))
        .orderBy(asc(reminderAgentAttentionTable.queuedAt), asc(reminderAgentAttentionTable.id));
    return rows.flatMap((row) =>
        row.script
            ? [
                  {
                      agentId: row.agentId,
                      attentionId: row.attentionId,
                      fireId: row.fireId,
                      reminderId: row.reminderId,
                      script: row.script,
                      type: 'reminder-script' as const,
                  },
              ]
            : []
    );
}

export async function settleReminderScript(
    db: GrottoDatabase,
    computerId: string,
    result: ReminderScriptResult,
    enqueue: (
        tx: GrottoDatabase,
        input: {
            agentId: string;
            chatId: string;
            content: string;
            dedupeKey: string;
            sequence: number;
            serverId: string;
            source: string;
        }
    ) => Promise<void>
) {
    const [identity] = await db
        .select({
            computerId: agentsTable.computerId,
            serverId: reminderAgentAttentionTable.serverId,
        })
        .from(reminderAgentAttentionTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, reminderAgentAttentionTable.serverId),
                eq(agentsTable.id, reminderAgentAttentionTable.agentId)
            )
        )
        .where(
            and(
                eq(reminderAgentAttentionTable.id, result.attentionId),
                eq(reminderAgentAttentionTable.agentId, result.agentId),
                eq(reminderAgentAttentionTable.fireId, result.fireId)
            )
        )
        .limit(1);
    if (!identity || identity.computerId !== computerId) {
        return;
    }
    const event = await db.transaction(async (tx) => {
        await lockServerRow(tx, identity.serverId);
        const [attention] = await tx
            .select()
            .from(reminderAgentAttentionTable)
            .where(
                and(
                    eq(reminderAgentAttentionTable.serverId, identity.serverId),
                    eq(reminderAgentAttentionTable.id, result.attentionId),
                    eq(reminderAgentAttentionTable.agentId, result.agentId),
                    eq(reminderAgentAttentionTable.fireId, result.fireId)
                )
            )
            .for('update');
        if (!attention) {
            return null;
        }
        await tx
            .update(reminderFiresTable)
            .set({
                scriptExitCode: result.exitCode,
                scriptOutput: result.output || null,
                scriptTimedOut: result.timedOut,
            })
            .where(
                and(
                    eq(reminderFiresTable.serverId, identity.serverId),
                    eq(reminderFiresTable.id, attention.fireId)
                )
            );
        await tx
            .delete(reminderAgentAttentionTable)
            .where(
                and(
                    eq(reminderAgentAttentionTable.serverId, identity.serverId),
                    eq(reminderAgentAttentionTable.id, attention.id)
                )
            );
        const content = scriptResultContent(result);
        if (!content) {
            return null;
        }
        const [chat] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: sql`now()`,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(
                and(
                    eq(chatsTable.serverId, identity.serverId),
                    eq(chatsTable.id, attention.anchorChatId),
                    isNull(chatsTable.archivedAt),
                    isNull(chatsTable.deletedAt),
                    or(
                        isNull(chatsTable.parentChatId),
                        sql`exists (
                            select 1 from chats parent
                            where parent.server_id = ${chatsTable.serverId}
                                and parent.id = ${chatsTable.parentChatId}
                                and parent.archived_at is null
                                and parent.deleted_at is null
                        )`
                    )
                )
            )
            .returning({
                parentChatId: chatsTable.parentChatId,
                sequence: chatsTable.lastMessageSequence,
            });
        if (!chat) {
            return null;
        }
        const messageId = createOpaqueId('msg');
        await tx.insert(chatMessagesTable).values({
            chatId: attention.anchorChatId,
            content,
            id: messageId,
            nonce: `reminder:script:${attention.id}`,
            sequence: chat.sequence,
            serverId: identity.serverId,
            systemAuthor: 'reminder',
        });
        await enqueue(tx, {
            agentId: attention.agentId,
            chatId: attention.anchorChatId,
            content,
            dedupeKey: messageId,
            sequence: chat.sequence,
            serverId: identity.serverId,
            source: 'reminder-script',
        });
        return await insertMessageEvent(tx, {
            chatId: attention.anchorChatId,
            createdAt: new Date(),
            messageId,
            parentChatId: chat.parentChatId,
            sequence: chat.sequence,
            serverId: identity.serverId,
        });
    });
    if (event) {
        emitDurableChatEvent({ audienceUserId: null, event: event as ServerDurableEvent });
    }
}

function scriptResultContent(result: ReminderScriptResult) {
    // Agent launch envelopes cap one inbox item's content at 32 KiB.
    const output = result.output.trim().slice(0, 30_000);
    if (!output && result.exitCode === 0 && !result.timedOut) {
        return null;
    }
    if (result.timedOut) {
        return `🔔 Reminder script timed out.${output ? `\n${output}` : ''}`;
    }
    if (result.exitCode !== 0) {
        return `🔔 Reminder script exited ${result.exitCode}.${output ? `\n${output}` : ''}`;
    }
    return `🔔 Reminder script output:\n${output}`;
}
