import type { HostedDurableEvent } from '@tavern/api';
import { and, asc, eq, lte, notInArray } from 'drizzle-orm';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    chatMessagesTable,
    chatsTable,
    reminderAgentAttentionTable,
    reminderFiresTable,
    remindersTable,
} from '../postgres/schema.ts';
import { nextReminderFireAt, parseReminderRepeat } from './cadence.ts';
import {
    insertAnchoredReminderChangedEvent,
    insertReminderChangedEvent,
} from './reminder-events.ts';
import {
    insertMessageEvent,
    ReminderAgentInactiveError,
    ReminderAnchorAccessError,
    type ReminderClock,
    requireActiveAgent,
    requireAgentAnchor,
} from './reminder-model.ts';

export async function tickHostedReminders(db: GrottoDatabase, clock: ReminderClock) {
    const now = clock.now();
    const failedReminderIds: string[] = [];
    let fired = 0;
    while (true) {
        let result: HostedDurableEvent[] | null;
        try {
            result = await fireNextDueReminder(db, now, failedReminderIds);
        } catch (cause) {
            if (!(cause instanceof ReminderFireError)) {
                throw cause;
            }
            failedReminderIds.push(cause.reminderId);
            continue;
        }
        if (!result) {
            if (failedReminderIds.length > 0) {
                throw new Error('One or more hosted reminders could not fire.');
            }
            return { fired };
        }
        fired += 1;
        for (const event of result) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }
    }
}

async function fireNextDueReminder(
    db: GrottoDatabase,
    now: Date,
    excludedReminderIds: string[]
): Promise<HostedDurableEvent[] | null> {
    let selectedReminderId: string | null = null;
    try {
        return await db.transaction(async (tx) => {
            const [reminder] = await tx
                .select()
                .from(remindersTable)
                .where(
                    and(
                        eq(remindersTable.status, 'scheduled'),
                        lte(remindersTable.fireAt, now),
                        excludedReminderIds.length > 0
                            ? notInArray(remindersTable.id, excludedReminderIds)
                            : undefined
                    )
                )
                .orderBy(asc(remindersTable.fireAt), asc(remindersTable.id))
                .limit(1)
                .for('update', { skipLocked: true });
            if (!reminder) {
                return null;
            }
            selectedReminderId = reminder.id;

            try {
                await requireActiveAgent(tx, reminder.serverId, reminder.ownerAgentId);
                await requireAgentAnchor(tx, {
                    agentId: reminder.ownerAgentId,
                    anchorChatId: reminder.anchorChatId,
                    anchorMessageId: reminder.anchorMessageId,
                    serverId: reminder.serverId,
                });
            } catch (cause) {
                if (
                    cause instanceof ReminderAgentInactiveError ||
                    cause instanceof ReminderAnchorAccessError
                ) {
                    return [await cancelUnauthorizedReminder(tx, reminder, now)];
                }
                throw cause;
            }
            await tx
                .select({ id: chatsTable.id })
                .from(chatsTable)
                .where(
                    and(
                        eq(chatsTable.serverId, reminder.serverId),
                        eq(chatsTable.id, reminder.anchorChatId)
                    )
                )
                .for('update');

            const [chat] = await tx
                .update(chatsTable)
                .set({
                    lastActivityAt: now,
                    lastMessageSequence: chatsTable.lastMessageSequence,
                })
                .where(
                    and(
                        eq(chatsTable.serverId, reminder.serverId),
                        eq(chatsTable.id, reminder.anchorChatId)
                    )
                )
                .returning({
                    parentChatId: chatsTable.parentChatId,
                    sequence: chatsTable.lastMessageSequence,
                });
            if (!chat) {
                throw new Error('The reminder anchor Chat no longer exists.');
            }
            const sequence = chat.sequence + 1;
            await tx
                .update(chatsTable)
                .set({ lastMessageSequence: sequence })
                .where(
                    and(
                        eq(chatsTable.serverId, reminder.serverId),
                        eq(chatsTable.id, reminder.anchorChatId)
                    )
                );

            const fireId = createOpaqueId('rmf');
            const receiptId = createOpaqueId('msg');
            await tx.insert(chatMessagesTable).values({
                chatId: reminder.anchorChatId,
                content: `🔔 Reminder: ${reminder.title}`,
                createdAt: now,
                id: receiptId,
                nonce: `reminder:fire:${receiptId}`,
                sequence,
                serverId: reminder.serverId,
                systemAuthor: 'reminder',
            });
            await tx.insert(reminderFiresTable).values({
                firedAt: now,
                id: fireId,
                receiptMessageId: receiptId,
                reminderId: reminder.id,
                scheduledFor: reminder.fireAt,
                serverId: reminder.serverId,
            });
            await tx.insert(reminderAgentAttentionTable).values({
                agentId: reminder.ownerAgentId,
                anchorChatId: reminder.anchorChatId,
                fireId,
                id: createOpaqueId('rma'),
                kind: reminder.script === null ? 'reminder' : 'reminder_script',
                queuedAt: now,
                receiptMessageId: receiptId,
                reminderId: reminder.id,
                script: reminder.script,
                serverId: reminder.serverId,
            });

            const repeat = reminder.repeat ? parseReminderRepeat(reminder.repeat) : null;
            await tx
                .update(remindersTable)
                .set({
                    fireAt: repeat
                        ? new Date(nextReminderFireAt(repeat, now.getTime(), reminder.timezone))
                        : reminder.fireAt,
                    status: repeat ? 'scheduled' : 'fired',
                    updatedAt: now,
                    version: reminder.version + 1,
                })
                .where(
                    and(
                        eq(remindersTable.serverId, reminder.serverId),
                        eq(remindersTable.id, reminder.id)
                    )
                );
            const messageEvent = await insertMessageEvent(tx, {
                chatId: reminder.anchorChatId,
                createdAt: now,
                messageId: receiptId,
                parentChatId: chat.parentChatId,
                sequence,
                serverId: reminder.serverId,
            });
            const reminderEvent = await insertReminderChangedEvent(tx, {
                action: 'fired',
                chatId: reminder.anchorChatId,
                createdAt: now,
                parentChatId: chat.parentChatId,
                reminderId: reminder.id,
                sequence,
                serverId: reminder.serverId,
            });
            return [messageEvent, reminderEvent];
        });
    } catch (cause) {
        if (selectedReminderId) {
            throw new ReminderFireError(selectedReminderId, cause);
        }
        throw cause;
    }
}

class ReminderFireError extends Error {
    readonly reminderId: string;

    constructor(reminderId: string, cause: unknown) {
        super('A hosted reminder could not fire.', { cause });
        this.name = 'ReminderFireError';
        this.reminderId = reminderId;
    }
}

async function cancelUnauthorizedReminder(
    db: GrottoDatabase,
    reminder: typeof remindersTable.$inferSelect,
    now: Date
) {
    await db
        .update(remindersTable)
        .set({
            status: 'canceled',
            updatedAt: now,
            version: reminder.version + 1,
        })
        .where(
            and(eq(remindersTable.serverId, reminder.serverId), eq(remindersTable.id, reminder.id))
        );
    await db
        .delete(reminderAgentAttentionTable)
        .where(
            and(
                eq(reminderAgentAttentionTable.serverId, reminder.serverId),
                eq(reminderAgentAttentionTable.reminderId, reminder.id)
            )
        );
    return insertAnchoredReminderChangedEvent(db, {
        action: 'canceled',
        chatId: reminder.anchorChatId,
        createdAt: now,
        reminderId: reminder.id,
        serverId: reminder.serverId,
    });
}
