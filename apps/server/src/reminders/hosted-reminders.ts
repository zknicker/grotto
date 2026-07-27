import { and, asc, eq, sql } from 'drizzle-orm';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    reminderCommandsTable,
    remindersTable,
} from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { isValidReminderTimezone, nextReminderFireAt, parseReminderRepeat } from './cadence.ts';
import { lockReminderCommand, parseReminderCommandResult } from './mutations.ts';
import { insertReminderChangedEvent } from './reminder-events.ts';
import {
    type HostedReminder,
    insertMessageEvent,
    type ReminderClock,
    ReminderCommandConflictError,
    requireActiveAgent,
    requireAgentAnchor,
    type ScheduleHostedReminderInput,
    scheduleReceipt,
    toHostedReminder,
    validateScheduleInput,
} from './reminder-model.ts';

export {
    cancelHostedReminder,
    ReminderVersionConflictError,
} from './mutations.ts';
export type {
    HostedReminder,
    ReminderClock,
    ScheduleHostedReminderInput,
} from './reminder-model.ts';
export { ReminderCommandConflictError } from './reminder-model.ts';
export {
    listHostedReminderFires,
    listReminderAgentAttention,
} from './reminder-queries.ts';
export {
    snoozeHostedReminder,
    updateHostedReminder,
} from './reschedule.ts';
export { tickHostedReminders } from './scheduler.ts';

export async function scheduleHostedReminder(
    db: GrottoDatabase,
    agentId: string,
    input: ScheduleHostedReminderInput,
    clock: ReminderClock
): Promise<{ idempotent: boolean; reminder: HostedReminder }> {
    const now = clock.now();
    const title = input.title.trim();
    const repeat = input.repeat ? parseReminderRepeat(input.repeat) : null;
    validateScheduleInput(input, { repeat, title });
    const fingerprint = JSON.stringify({
        anchorChatId: input.anchorChatId,
        anchorMessageId: input.anchorMessageId,
        fireAt: input.fireAt.toISOString(),
        repeat: repeat?.spec ?? null,
        script: input.script ?? null,
        title,
    });

    const result = await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const agent = await requireActiveAgent(tx, input.serverId, agentId);
        if (!isValidReminderTimezone(agent.homeTimezone)) {
            throw new Error('The reminder author must have a valid IANA timezone.');
        }
        if (repeat) {
            nextReminderFireAt(repeat, input.fireAt.getTime(), agent.homeTimezone);
        }
        const anchor = await requireAgentAnchor(tx, {
            agentId,
            anchorChatId: input.anchorChatId,
            anchorMessageId: input.anchorMessageId,
            serverId: input.serverId,
        });
        await lockReminderCommand(tx, input.serverId, 'agent', agentId, input.commandId);
        const [existingCommand] = await tx
            .select({
                fingerprint: reminderCommandsTable.requestFingerprint,
                resultSnapshot: reminderCommandsTable.resultSnapshot,
            })
            .from(reminderCommandsTable)
            .where(
                and(
                    eq(reminderCommandsTable.serverId, input.serverId),
                    eq(reminderCommandsTable.actorKind, 'agent'),
                    eq(reminderCommandsTable.actorId, agentId),
                    eq(reminderCommandsTable.commandId, input.commandId)
                )
            )
            .limit(1);
        if (existingCommand) {
            if (existingCommand.fingerprint !== fingerprint) {
                throw new ReminderCommandConflictError();
            }
            return {
                events: [],
                idempotent: true,
                reminder: parseReminderCommandResult(existingCommand.resultSnapshot),
            };
        }
        if (input.fireAt.getTime() <= now.getTime()) {
            throw new Error('Reminder fire time must be in the future.');
        }

        await tx.execute(sql`
            select id from chats
            where server_id = ${input.serverId} and id = ${input.anchorChatId}
            for update
        `);
        const reminderId = createOpaqueId('rem');
        const [reminder] = await tx
            .insert(remindersTable)
            .values({
                anchorChatId: input.anchorChatId,
                anchorMessageId: input.anchorMessageId,
                createdAt: now,
                fireAt: input.fireAt,
                id: reminderId,
                ownerAgentId: agentId,
                repeat: repeat?.spec ?? null,
                script: input.script ?? null,
                serverId: input.serverId,
                status: 'scheduled',
                timezone: agent.homeTimezone,
                title,
                updatedAt: now,
            })
            .returning();
        const [updatedChat] = await tx
            .update(chatsTable)
            .set({
                lastActivityAt: now,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(
                and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.anchorChatId))
            )
            .returning({ sequence: chatsTable.lastMessageSequence });
        if (!(reminder && updatedChat)) {
            throw new Error('Failed to schedule the reminder.');
        }
        const hostedReminder = toHostedReminder(reminder, agent.handle);

        const [receipt] = await tx
            .insert(chatMessagesTable)
            .values({
                chatId: input.anchorChatId,
                content: scheduleReceipt(agent.handle, title, input.fireAt, repeat?.spec ?? null),
                createdAt: now,
                id: createOpaqueId('msg'),
                nonce: `reminder:schedule:${reminderId}`,
                sequence: updatedChat.sequence,
                serverId: input.serverId,
                systemAuthor: 'reminder',
            })
            .returning();
        await tx
            .update(remindersTable)
            .set({ scheduleReceiptMessageId: receipt.id })
            .where(
                and(eq(remindersTable.serverId, input.serverId), eq(remindersTable.id, reminderId))
            );
        await tx.insert(reminderCommandsTable).values({
            action: 'schedule',
            actorId: agentId,
            actorKind: 'agent',
            appliedVersion: reminder.version,
            commandId: input.commandId,
            createdAt: now,
            id: createOpaqueId('rcm'),
            reminderId,
            requestFingerprint: fingerprint,
            resultSnapshot: hostedReminder,
            serverId: input.serverId,
        });

        const messageEvent = await insertMessageEvent(tx, {
            chatId: input.anchorChatId,
            createdAt: now,
            messageId: receipt.id,
            parentChatId: anchor.parentChatId,
            sequence: receipt.sequence,
            serverId: input.serverId,
        });
        const reminderEvent = await insertReminderChangedEvent(tx, {
            action: 'scheduled',
            chatId: input.anchorChatId,
            createdAt: now,
            parentChatId: anchor.parentChatId,
            reminderId,
            sequence: receipt.sequence,
            serverId: input.serverId,
        });
        return {
            events: [messageEvent, reminderEvent],
            idempotent: false,
            reminder: hostedReminder,
        };
    });

    for (const event of result.events) {
        emitDurableChatEvent({ audienceUserId: null, event });
    }
    return { idempotent: result.idempotent, reminder: result.reminder };
}

export async function listHostedReminders(
    db: GrottoDatabase,
    input: {
        actor: { agentId: string; kind: 'agent' };
        serverId: string;
    }
): Promise<HostedReminder[]> {
    await requireActiveAgent(db, input.serverId, input.actor.agentId);
    const rows = await db
        .select({ agent: agentsTable, reminder: remindersTable })
        .from(remindersTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, remindersTable.serverId),
                eq(agentsTable.id, remindersTable.ownerAgentId)
            )
        )
        .where(
            and(
                eq(remindersTable.serverId, input.serverId),
                eq(remindersTable.ownerAgentId, input.actor.agentId)
            )
        )
        .orderBy(asc(remindersTable.fireAt), asc(remindersTable.id));
    await Promise.all(
        rows.map(({ reminder }) =>
            requireAgentAnchor(db, {
                agentId: input.actor.agentId,
                anchorChatId: reminder.anchorChatId,
                anchorMessageId: reminder.anchorMessageId,
                serverId: input.serverId,
            })
        )
    );
    return rows.map(({ agent, reminder }) => toHostedReminder(reminder, agent.handle));
}
