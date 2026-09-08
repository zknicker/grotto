import type { ServerDurableEvent } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';

export interface CloudAgentEventChat {
    kind: 'channel' | 'dm' | 'thread';
    parentChatId: string | null;
}

/**
 * The durable notification for one Cloud Agent work lifecycle change. Clients
 * refetch the Message; the event itself carries only identities.
 */
export async function insertCloudAgentWorkEvent(
    db: Pick<GrottoDatabase, 'insert' | 'update'>,
    input: {
        chat: CloudAgentEventChat;
        chatId: string;
        cloudAgentWorkId: string;
        messageId: string;
        sequence: number;
        serverId: string;
    }
): Promise<ServerDurableEvent> {
    const cursor = await allocateEventCursor(db, input.serverId);
    const [event] = await db
        .insert(chatEventsTable)
        .values({
            chatId: input.chatId,
            cloudAgentWorkId: input.cloudAgentWorkId,
            cursor,
            id: createOpaqueId('evt'),
            messageId: input.messageId,
            sequence: input.sequence,
            serverId: input.serverId,
            type: 'cloud-agent-work.updated',
        })
        .returning({
            createdAt: chatEventsTable.createdAt,
            cursor: chatEventsTable.cursor,
            id: chatEventsTable.id,
        });
    if (!event) {
        throw new Error('Failed to record the Cloud Agent work event.');
    }
    return {
        chatId: input.chatId,
        cloudAgentWorkId: input.cloudAgentWorkId,
        createdAt: event.createdAt.toISOString(),
        cursor: event.cursor.toString(),
        id: event.id,
        messageId: input.messageId,
        parentChatId: input.chat.kind === 'thread' ? input.chat.parentChatId : null,
        sequence: input.sequence,
        serverId: input.serverId,
        type: 'cloud-agent-work.updated',
    };
}

/** The Chat placement and Message sequence one lifecycle event needs. */
export async function readCloudAgentEventAnchor(
    db: Pick<GrottoDatabase, 'select'>,
    input: { chatId: string; messageId: string; serverId: string }
): Promise<{ chat: CloudAgentEventChat; sequence: number }> {
    const [row] = await db
        .select({
            kind: chatsTable.kind,
            parentChatId: chatsTable.parentChatId,
            sequence: chatMessagesTable.sequence,
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
                eq(chatMessagesTable.id, input.messageId)
            )
        )
        .limit(1);
    if (!row) {
        throw new Error('The Cloud Agent work Message no longer exists.');
    }
    return {
        chat: { kind: row.kind, parentChatId: row.parentChatId },
        sequence: row.sequence,
    };
}
