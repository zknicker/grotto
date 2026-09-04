import {
    type AutomationFireContext,
    automationPayloadExcerptMaxChars,
    automationSnippetMaxChars,
    type MessageCause,
} from '@grotto/api';
import { and, count, eq, lte } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    chatMessagesTable,
    messageCausesTable,
    reminderFiresTable,
    remindersTable,
    triggerFiresTable,
    triggersTable,
} from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { readMessageCauses } from './message-cause-read.ts';

export class AutomationFireContextNotFoundError extends Error {
    constructor() {
        super('That message has no automation provenance.');
        this.name = 'AutomationFireContextNotFoundError';
    }
}

/**
 * The Thread pane's context card for one caused message: the same provenance
 * the header mark shows, plus the fire's own detail. Authorization is ordinary
 * Chat access — anyone who can read the message can see why it was written.
 */
export async function readAutomationFireContext(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { messageId: string; serverId: string }
): Promise<AutomationFireContext> {
    const [message] = await db
        .select({ chatId: chatMessagesTable.chatId })
        .from(chatMessagesTable)
        .innerJoin(
            messageCausesTable,
            and(
                eq(messageCausesTable.serverId, chatMessagesTable.serverId),
                eq(messageCausesTable.messageId, chatMessagesTable.id)
            )
        )
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                eq(chatMessagesTable.id, input.messageId)
            )
        )
        .limit(1);
    if (!message) {
        throw new AutomationFireContextNotFoundError();
    }
    await requireChatAccess(db, member, { chatId: message.chatId, serverId: input.serverId });
    const cause = (await readMessageCauses(db, input.serverId, [input.messageId])).get(
        input.messageId
    );
    if (!cause) {
        throw new AutomationFireContextNotFoundError();
    }
    return cause.kind === 'trigger'
        ? await triggerFireContext(db, input.serverId, cause)
        : await reminderFireContext(db, input.serverId, cause);
}

async function triggerFireContext(
    db: GrottoDatabase,
    serverId: string,
    cause: MessageCause
): Promise<AutomationFireContext> {
    const [fire] = await db
        .select({
            anchorChatId: triggersTable.anchorChatId,
            contentType: triggerFiresTable.contentType,
            payload: triggerFiresTable.payload,
            payloadBytes: triggerFiresTable.payloadBytes,
            receivedAt: triggerFiresTable.receivedAt,
        })
        .from(triggerFiresTable)
        .innerJoin(
            triggersTable,
            and(
                eq(triggersTable.serverId, triggerFiresTable.serverId),
                eq(triggersTable.id, triggerFiresTable.triggerId)
            )
        )
        .where(
            and(eq(triggerFiresTable.serverId, serverId), eq(triggerFiresTable.id, cause.fireId))
        )
        .limit(1);
    if (!fire) {
        throw new AutomationFireContextNotFoundError();
    }
    const [ordinal] = await db
        .select({ total: count() })
        .from(triggerFiresTable)
        .where(
            and(
                eq(triggerFiresTable.serverId, serverId),
                eq(triggerFiresTable.triggerId, cause.automationId),
                lte(triggerFiresTable.receivedAt, fire.receivedAt)
            )
        );
    const [stored] = await db
        .select({ total: count() })
        .from(triggerFiresTable)
        .where(
            and(
                eq(triggerFiresTable.serverId, serverId),
                eq(triggerFiresTable.triggerId, cause.automationId)
            )
        );
    const payload = fire.payload.slice(0, automationPayloadExcerptMaxChars);
    return {
        anchorChatId: fire.anchorChatId,
        anchorExcerpt: null,
        anchorMessageId: null,
        cause,
        contentType: fire.contentType,
        firedAt: fire.receivedAt.toISOString(),
        fireOrdinal: Math.max(ordinal?.total ?? 1, 1),
        // Stored fires are pruned; the Trigger's own counter is the honest total.
        fireTotal: Math.max(cause.fireCount, stored?.total ?? 1, 1),
        nextFireAt: null,
        payload,
        payloadBytes: fire.payloadBytes,
        payloadTruncated: payload.length < fire.payload.length,
        repeat: null,
    };
}

async function reminderFireContext(
    db: GrottoDatabase,
    serverId: string,
    cause: MessageCause
): Promise<AutomationFireContext> {
    const [fire] = await db
        .select({
            anchorChatId: remindersTable.anchorChatId,
            anchorContent: chatMessagesTable.content,
            anchorMessageId: remindersTable.anchorMessageId,
            fireAt: remindersTable.fireAt,
            firedAt: reminderFiresTable.firedAt,
            repeat: remindersTable.repeat,
            status: remindersTable.status,
        })
        .from(reminderFiresTable)
        .innerJoin(
            remindersTable,
            and(
                eq(remindersTable.serverId, reminderFiresTable.serverId),
                eq(remindersTable.id, reminderFiresTable.reminderId)
            )
        )
        .leftJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, remindersTable.serverId),
                eq(chatMessagesTable.id, remindersTable.anchorMessageId)
            )
        )
        .where(
            and(eq(reminderFiresTable.serverId, serverId), eq(reminderFiresTable.id, cause.fireId))
        )
        .limit(1);
    if (!fire) {
        throw new AutomationFireContextNotFoundError();
    }
    const [ordinal] = await db
        .select({ total: count() })
        .from(reminderFiresTable)
        .where(
            and(
                eq(reminderFiresTable.serverId, serverId),
                eq(reminderFiresTable.reminderId, cause.automationId),
                lte(reminderFiresTable.firedAt, fire.firedAt)
            )
        );
    return {
        anchorChatId: fire.anchorChatId,
        anchorExcerpt: fire.anchorContent
            ? fire.anchorContent.trim().slice(0, automationSnippetMaxChars)
            : null,
        anchorMessageId: fire.anchorMessageId,
        cause,
        contentType: null,
        firedAt: fire.firedAt.toISOString(),
        fireOrdinal: Math.max(ordinal?.total ?? 1, 1),
        fireTotal: Math.max(cause.fireCount, 1),
        nextFireAt: fire.status === 'scheduled' ? fire.fireAt.toISOString() : null,
        payload: null,
        payloadBytes: null,
        payloadTruncated: false,
        repeat: fire.repeat,
    };
}
