import type { ServerDurableEvent } from '@grotto/api';
import { and, eq, isNull } from 'drizzle-orm';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatEventsTable,
    chatMessagesTable,
    chatsTable,
    remindersTable,
} from '../postgres/schema.ts';
import type { parseReminderRepeat } from './cadence.ts';

export interface ReminderClock {
    now(): Date;
}

export interface Reminder {
    anchorChatId: string;
    anchorMessageId: string;
    createdAt: string;
    fireAt: string;
    hasScript: boolean;
    id: string;
    ownerAgentId: string;
    ownerHandle: string;
    repeat: string | null;
    scriptBytes: number;
    status: 'canceled' | 'fired' | 'scheduled';
    timezone: string;
    title: string;
    updatedAt: string;
    version: number;
}

export interface ScheduleReminderInput {
    anchorChatId: string;
    anchorMessageId: string;
    commandId: string;
    fireAt: Date;
    repeat?: string | null;
    script?: string | null;
    serverId: string;
    title: string;
}

export class ReminderCommandConflictError extends Error {
    constructor() {
        super('That reminder command id was already used for different input.');
        this.name = 'ReminderCommandConflictError';
    }
}

export class ReminderAgentInactiveError extends Error {
    constructor() {
        super('The reminder author is not an active Agent in this Server.');
        this.name = 'ReminderAgentInactiveError';
    }
}

export class ReminderAnchorAccessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ReminderAnchorAccessError';
    }
}

export async function requireActiveAgent(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    agentId: string
) {
    const [agent] = await db
        .select()
        .from(agentsTable)
        .where(
            and(
                eq(agentsTable.serverId, serverId),
                eq(agentsTable.id, agentId),
                isNull(agentsTable.retiredAt)
            )
        )
        .limit(1);
    if (!agent) {
        throw new ReminderAgentInactiveError();
    }
    return agent;
}

export async function requireAgentAnchor(
    db: Pick<GrottoDatabase, 'select'>,
    input: {
        agentId: string;
        anchorChatId: string;
        anchorMessageId: string;
        serverId: string;
    }
) {
    const [anchor] = await db
        .select({
            chatKind: chatsTable.kind,
            dmAgentId: chatsTable.dmAgentId,
            messageId: chatMessagesTable.id,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatMessagesTable)
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, chatMessagesTable.serverId),
                eq(chatsTable.id, chatMessagesTable.chatId)
            )
        )
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                eq(chatMessagesTable.chatId, input.anchorChatId),
                eq(chatMessagesTable.id, input.anchorMessageId)
            )
        )
        .limit(1);
    const accessChatId = anchor?.chatKind === 'thread' ? anchor.parentChatId : input.anchorChatId;
    if (!(anchor && accessChatId)) {
        throw new ReminderAnchorAccessError('The reminder anchor is not a message in this Server.');
    }
    if (anchor.chatKind === 'dm' && anchor.dmAgentId === input.agentId) {
        return anchor;
    }
    const [access] = await db
        .select({ agentId: channelAgentParticipantsTable.agentId })
        .from(channelAgentParticipantsTable)
        .where(
            and(
                eq(channelAgentParticipantsTable.serverId, input.serverId),
                eq(channelAgentParticipantsTable.chatId, accessChatId),
                eq(channelAgentParticipantsTable.agentId, input.agentId)
            )
        )
        .limit(1);
    if (!access) {
        throw new ReminderAnchorAccessError('The reminder author cannot access the anchor Chat.');
    }
    return anchor;
}

export async function readReminder(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    reminderId: string
) {
    const [row] = await db
        .select({ agent: agentsTable, reminder: remindersTable })
        .from(remindersTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, remindersTable.serverId),
                eq(agentsTable.id, remindersTable.ownerAgentId)
            )
        )
        .where(and(eq(remindersTable.serverId, serverId), eq(remindersTable.id, reminderId)))
        .limit(1);
    if (!row) {
        throw new Error('The scheduled reminder could not be read.');
    }
    return toReminder(row.reminder, row.agent.handle);
}

export async function insertMessageEvent(
    db: GrottoDatabase,
    input: {
        chatId: string;
        createdAt: Date;
        messageId: string;
        parentChatId: string | null;
        sequence: number;
        serverId: string;
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            createdAt: input.createdAt,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'message.created',
        })
        .returning({ id: chatEventsTable.id });
    return {
        chatId: input.chatId,
        createdAt: input.createdAt.toISOString(),
        cursor: cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: input.parentChatId,
        sequence: input.sequence,
        serverId: input.serverId,
        type: 'message.created',
    };
}

export function validateScheduleInput(
    input: ScheduleReminderInput,
    parsed: { repeat: ReturnType<typeof parseReminderRepeat>; title: string }
) {
    if (parsed.title.length === 0 || parsed.title.length > 300) {
        throw new Error('Reminder title must be between 1 and 300 characters.');
    }
    if (input.repeat && !parsed.repeat) {
        throw new Error('Reminder repeat does not use the supported grammar.');
    }
    const bytes = input.script == null ? 0 : Buffer.byteLength(input.script);
    if (input.script != null && (bytes < 1 || bytes > 16_384)) {
        throw new Error('Reminder script must be between 1 and 16384 UTF-8 bytes.');
    }
}

export function scheduleReceipt(
    ownerHandle: string,
    title: string,
    fireAt: Date,
    repeat: string | null
) {
    const cadence = repeat ? `, repeats ${repeat}` : '';
    return `🔔 @${ownerHandle} scheduled a reminder: "${title}" (fires ${fireAt.toISOString()}${cadence})`;
}

export function toReminder(
    reminder: typeof remindersTable.$inferSelect,
    ownerHandle: string
): Reminder {
    return {
        anchorChatId: reminder.anchorChatId,
        anchorMessageId: reminder.anchorMessageId,
        createdAt: reminder.createdAt.toISOString(),
        fireAt: reminder.fireAt.toISOString(),
        hasScript: reminder.script !== null,
        id: reminder.id,
        ownerAgentId: reminder.ownerAgentId,
        ownerHandle,
        repeat: reminder.repeat,
        scriptBytes: reminder.script ? Buffer.byteLength(reminder.script) : 0,
        status: reminder.status,
        timezone: reminder.timezone,
        title: reminder.title,
        updatedAt: reminder.updatedAt.toISOString(),
        version: reminder.version,
    };
}
